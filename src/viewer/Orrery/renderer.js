
import {vec3, vec4, quat} from 'gl-matrix';

import Logger from 'js-logger';

import {StellarObjectStar, StellarObjectPlanet} from '../../stellar/object.js';
import {SolarSystem} from '../../stellar/system.js';

import Renderer from '../../webgl/renderer.js';
import Scene, {RENDER_ORDER} from '../../webgl/scene.js';
import Material, {BLEND, DEPTH} from '../../webgl/material.js';
import {WRAP} from '../../webgl/texture.js';
import Spatial, {MeshData, CameraData} from '../../webgl/spatial.js';

import {createQuadsphere} from './mesh.js';
import default_vert from './shaders/default.vert';

import atmosphere_body_vert from './shaders/atmosphere-body.vert';
import atmosphere_frag from './shaders/atmosphere.frag';

import star_frag from './shaders/star.frag';
import planet_frag from './shaders/planet.frag';
import planet_with_atmosphere_frag from './shaders/planet-with-atmosphere.frag';

import TransitionManager, {Transition} from '../../util/transition.js';

class StellarObjectBridge {

  constructor(renderer, stellar_object) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    
    this.object = stellar_object;

    this.spatial = new Spatial(this.scene)
      .addTo(this.scene);
  }

  create() {
  }

  update() {
    vec3.copy(this.spatial.position, this.object.position);
  }

  destroy() {
  }
  
}

class StellarObjectStarBridge extends StellarObjectBridge {

  create() {
    super.create();
    
    // Create the earth material.
    let star_material = new Material(this.scene, 'stellar-body-star');
    
    let star = new Spatial(this.scene)
        .setName(`object/${this.object.name}`)
        .setData(new MeshData('quadsphere', star_material))
        .addTo(this.spatial);

    let star_diameter = this.object.radius * 2;

    star_material.setUniform('uStarColor', vec3.fromValues(1, 0.8, 0.5));
    
    vec3.set(star.scale, star_diameter, star_diameter, star_diameter);
    //vec3.set(sun.position, 0, 0, sun_distance);
  }


}

class StellarObjectPlanetBridge extends StellarObjectBridge {

  create() {
    super.create();

    let object = this.object;

    let texture_name_prefix = `stellar-object-planet-(${object.name})`;

    let texture_names = {
      color: `${texture_name_prefix}-color`,
      landinfo: `${texture_name_prefix}-landinfo`,
      normal: `${texture_name_prefix}-normal`
    };

    // Get the textures we need.
    let tex = this.renderer.createTexture(texture_names.color)
        .setFallback('@fallback-cube');

    if(object.render_info.textures.color) {
        tex.loadCubemap(object.render_info.textures.color);
    }
    
    tex = this.renderer.createTexture(texture_names.landinfo)
      .setFallback('stellar-body-planet-landinfo');
    
    if(object.render_info.textures.landinfo) {
      tex.loadCubemap(object.render_info.textures.landinfo);
    }
    
    tex = this.renderer.createTexture(texture_names.normal)
      .setFallback('@fallback-cube-normal');
    
    if(object.render_info.textures.normal) {
      tex.loadCubemap(object.render_info.textures.normal);
    }

    let shader = 'stellar-body-planet';

    if(object.render_info.atmosphere) {
      shader = 'stellar-body-planet-with-atmosphere';
    }
    
    // Create the earth material.
    let planet_body_material = new Material(this.scene, shader);
    
    let earth = new Spatial(this.scene)
        .setName('body-earth')
        .setData(new MeshData('quadsphere', planet_body_material))
        .addTo(this.spatial);

    earth.scale = vec3.fromValues(this.object.radius * 2, this.object.radius * 2, this.object.radius * 2);

    planet_body_material
      .setUniforms({
        'uOceanColor': vec3.fromValues(0.02, 0.17, 0.3),
        'uNightColor': vec3.fromValues(1.0, 0.8, 0.6),
        'uColorCube': texture_names.color,
        'uNormalCube': texture_names.normal,
        'uLandinfoCube': texture_names.landinfo,
      });
    
    if(object.render_info.atmosphere) {
      // Create the atmosphere.
      let atmosphere_mesh = new MeshData('atmosphere', this.renderer.materials.atmosphere);
      atmosphere_mesh.order = RENDER_ORDER.TRANSPARENT;
      
      let atmosphere = new Spatial(this.scene)
          .setName('atmosphere')
          .setData(atmosphere_mesh);

      let atmosphere_diameter = 1.1;
      
      atmosphere.scale = vec3.fromValues(atmosphere_diameter, atmosphere_diameter, atmosphere_diameter);

      let mie_strength = 200;
      let mie_power = 400;

      // Set up the scaling.
      let atmosphere_scatter_color = vec4.fromValues(10, 20, 50);
      vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 1 / 4);
      vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 5.0);
      atmosphere_scatter_color[3] = mie_power;

      atmosphere.setUniform('uAtmosphereParameters', vec4.fromValues(1 / atmosphere_diameter / 2, 1 / 2, 25, mie_strength));
      atmosphere.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

      earth.setUniform('uAtmosphereParameters', vec4.fromValues(1 / 2, atmosphere_diameter / 2, 20, mie_strength));
      earth.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

      earth.add(atmosphere);
    }
  }


}

export default class OrreryRenderer extends Renderer {

  init() {
    this.options.desynchronized = true;

    this.input = {
      heading: 135,
      pitch: 0,
      distance: 0,

      focus: null,
    };

    this.stellar_system = new SolarSystem();

    this.stellar_objects = {};

    this.materials = {};

    this.transition_focus_position = new TransitionManager({
      position: vec3.create(),
      minimum_distance: 0,
    }, (from, to, fraction) => {
      let value = vec3.create();

      let resolvePosition = (pos) => {
        if(typeof pos === typeof '') {
          return this.stellar_system.getObject(pos).position;
        }

        return pos;
      };
      
      let from_position = resolvePosition(from.position);
      let to_position = resolvePosition(to.position);

      vec3.lerp(value, from_position, to_position, fraction);

      return {
        position: value,
        minimum_distance: (from.minimum_distance * (1 - fraction) + to.minimum_distance * fraction)
      };
    });

    super.init();
  }

  create() {
    super.create();

    this.on('updatebefore', this.handleUpdateBefore.bind(this));
    this.on('drawafter', this.handleDrawAfter.bind(this));
    this.on('tickafter', this.handleTickAfter.bind(this));

    this.scene = new Scene();
    
    this.createShaders();
    this.createMaterials();
    this.createQuadspheres();
    
    //this.createSun();
    //this.createEarth();
    this.createCamera();

    this.options = {
      ...this.options,
      max_anisotropy_level: 16,
      display_atmospheres: true
    };
    
    this.updateOrbits();
    
    this.setFocusObject('planet/earth', 0);
  }

  createBridge(name) {
    let object = this.stellar_system.getObject(name);
    
    let bridge = null;

    if(object instanceof StellarObjectStar) {
      bridge = new StellarObjectStarBridge(this, object);
    } else if(object instanceof StellarObjectPlanet) {
      bridge = new StellarObjectPlanetBridge(this, object);
    } else {
      return;
    }

    bridge.create();

    this.stellar_objects[name] = bridge;
  }

  createShaders() {
    this.createShader('stellar-body-planet', default_vert, planet_frag);
    this.createShader('stellar-body-planet-with-atmosphere', atmosphere_body_vert, planet_with_atmosphere_frag);

    this.createShader('atmosphere', default_vert, atmosphere_frag);

    this.createTexture('atmosphere-thickness-lut')
      .setFromShader(64, 64, (coord) => {
        let dotToThickness = (value, radius) => {
          return Math.sqrt(1 - Math.pow(1 - (value * radius), 2));
        };
        
        return vec4.fromValues(dotToThickness(coord[0], 1) - dotToThickness(coord[0], coord[1]), 0, 0, 1);
      })
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });
    
    this.createTexture('stellar-body-planet-landinfo')
      .setFromShaderCubemap(1, 1, (coord) => {
        return vec4.fromValues(0, 0, 0, 1);
      })
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });
    
    this.createShader('stellar-body-star', default_vert, star_frag);
  }

  createQuadspheres() {
    createQuadsphere(this, 'quadsphere', 32);
    createQuadsphere(this, 'atmosphere', 16, true);
  }

  createMaterials() {
    this.materials.atmosphere = new Material(this.scene, 'atmosphere');
    this.materials.atmosphere.blend_mode = BLEND.ADD;
    this.materials.atmosphere.depth_mode = DEPTH.READ_ONLY;
  }
  
  createCamera() {
    this.camera_focus = new Spatial(this.scene)
      .setName('-camera-focus');
    
    this.camera = new Spatial(this.scene)
      .setName('-camera')
      .setData(new CameraData(50, 1, 7500000000*1000));

    this.camera.position = vec3.fromValues(0, 0, 0);
    //quat.fromEuler(this.camera.rotation, 90, 0, 0);
    //this.camera.position = vec3.fromValues(0, 0, 10);

    this.camera_focus.add(this.camera);
    this.scene.root.add(this.camera_focus);
    
    this.scene.setCamera(this.camera);

    this.scene.origin = this.camera_focus;

    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
  }

  setFocusObject(name, duration) {
    if(this.input.focus === name) {
      return false;
    }

    if(!this.stellar_system.hasObject(name)) {
      Logger.warn(`Cannot assign non-existent object '${name}' as active object`);
      return false;
    }

    if(duration === undefined || duration === null) {
      duration = 5;
    }

    this.input.focus = name;

    let focus_body = this.getFocusObject();

    //console.log(focus_body, this.stellar_system);

    this.transition_focus_position.push(new Transition({
      position: name,
      minimum_distance: focus_body.radius * 2 + 20 * 1000
    }, duration * this.transition_focus_position.getCurrentFraction()));

    return true;
  }

  getFocusObject() {
    return this.stellar_system.getObject(this.input.focus);
  }

  setInput(new_input) {
    for(let key of Object.keys(new_input)) {
      this.input[key] = new_input[key];
    }
    
  }

  getCameraInfo() {
    return {
      distance: this.camera.position[2]
    };
  }
  
  updateFromInput() {
    let transition_value = this.transition_focus_position.getValue();
    
    this.camera_focus.position = transition_value.position;

    this.camera.position = vec3.fromValues(0, 0, this.input.distance + transition_value.minimum_distance);

    //console.log(values.heading);

    quat.fromEuler(this.camera_focus.rotation, this.input.pitch, this.input.heading, 0);
  }

  updateOrbits() {
    this.stellar_system.update();

    for(let object of Object.values(this.stellar_system.objects)) {
      if(!(object.name in this.stellar_objects)) {
        this.createBridge(object.name);
      }

      if(object.name in this.stellar_objects) {
        this.stellar_objects[object.name].update();
      }
    }
    
    //console.log(this.stellar_system.getObject('earth').position);

    //vec3.copy(this.bodies.earth.spatial.position, this.stellar_system.getObject('planet/earth').position);
    //vec3.copy(this.bodies.sun.spatial.position, this.stellar_system.getObject('star/sol').position);
  }
  
  handleUpdateBefore() {
    this.updateOrbits();
    
    this.updateFromInput();
    
    //this.atmosphere.setEnabled(this.options.display_atmospheres);

    //let scale = 1000000000000 * 1000;
    //this.scene.scale = vec3.fromValues(1 / scale, 1 / scale, 1 / scale);

    //let position = vec3.create();
    //mat4.getTranslation(position, this.bodies.earth.spatial.modelview_matrix);
    //mat4.getTranslation(position, this.bodies.earth.spatial.world_matrix);

    this.scene.setUniform('uStarPosition', this.scene.transformOrigin(this.stellar_system.getObject('star/sol').position));
    
    this.scene.setUniform('uStarColor', vec3.fromValues(1, 0.95, 0.9));
    
    //this.scene.setUniform('uStarColor', vec3.fromValues(0.2, 0.5, 1.0));
    //quat.fromEuler(this.earth.rotation, 0, now * 0.5, 0);

    this.paused = this.options.paused;
  }

  handleDrawAfter() {
    this.viewer.setState(state => ({
      stats_fps: this.performance.fps,
      stats_vertex_count: this.performance.vertex_count,
      stats_draw_call_count: this.performance.draw_call_count,
      stats_frame_count: this.performance.current_frame,
    }));
  }

  handleTickAfter() {
    this.viewer.setState(state => ({
      loading: this.isLoading()
    }));
  }
  
}
