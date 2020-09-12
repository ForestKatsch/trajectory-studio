
import {vec3, vec4, quat, mat4} from 'gl-matrix';

import Logger from 'js-logger';

import Orbit from '../../stellar/orbit.js';
import Body from '../../stellar/body.js';
import {SolarSystem} from '../../stellar/system.js';
import {LENGTH, formatLength} from '../../stellar/units.js';

import Renderer from '../../webgl/renderer.js';
import Scene, {RENDER_ORDER} from '../../webgl/scene.js';
import Material, {BLEND, DEPTH} from '../../webgl/material.js';
import {WRAP} from '../../webgl/texture.js';
import Spatial, {MeshData, CameraData} from '../../webgl/spatial.js';

import {createQuadsphere} from './mesh.js';
import default_vert from './shaders/default.vert';

import star_frag from './shaders/star.frag';
import earth_frag from './shaders/earth.frag';

import atmosphere_body_vert from './shaders/atmosphere-body.vert';
import atmosphere_frag from './shaders/atmosphere.frag';

import TransitionManager, {Transition} from '../../util/transition.js';

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

    this.bodies = {};

    this.materials = {};

    this.transition_focus_position = new TransitionManager({
      position: vec3.create(),
      minimum_distance: 0,
    }, (from, to, fraction) => {
      let value = vec3.create();

      let resolvePosition = (pos) => {
        if(typeof pos === typeof '') {
          return this.bodies[pos].spatial.position;
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
    
    this.createSun();
    this.createEarth();
    this.createCamera();

    this.options = {
      ...this.options,
      max_anisotropy_level: 16,
      display_atmospheres: true
    };
    
    this.setFocusBody('earth', 0);
  }

  createShaders() {
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
  }

  createQuadspheres() {
    createQuadsphere(this, 'quadsphere', 32);
    createQuadsphere(this, 'atmosphere', 12, true);
  }

  createMaterials() {
    this.materials.atmosphere = new Material(this.scene, 'atmosphere');
    this.materials.atmosphere.blend_mode = BLEND.ADD;
    this.materials.atmosphere.depth_mode = DEPTH.READ_ONLY;
  }

  createSun() {
    this.createShader('stellar-body-sun', default_vert, star_frag);

    // Create the earth material.
    let sun_material = new Material(this.scene, 'stellar-body-sun');
    
    let sun = new Spatial(this.scene)
      .setName('body-sun')
      .setData(new MeshData('quadsphere', sun_material))
      .addTo(this.scene);

    let sun_diameter = 1.3927 * 1000000 * 1000;

    this.bodies.sun = {
      parent: null,
      orbit: new Orbit(),
      spatial: sun,
      body: null
    };

    sun_material.setUniform('uStarColor', vec3.fromValues(1, 0.8, 0.5));
    
    vec3.set(sun.scale, sun_diameter, sun_diameter, sun_diameter);
    //vec3.set(sun.position, 0, 0, sun_distance);
  }

  createEarth() {
    // Get the textures we need.
    this.createTexture('stellar-body-earth-landinfo-cube')
      .loadCubemap('static/stellar/bodies/earth/landinfo-{id}.jpg');
    
    this.createTexture('stellar-body-earth-color-cube')
      .loadCubemap('static/stellar/bodies/earth/color-{id}.jpg');

    let normal = this.createTexture('stellar-body-earth-normal-cube')
      .setFallback('@fallback-cube-normal');

    this.on('loadcomplete', () => {
      normal.loadCubemap('static/stellar/bodies/earth/normal-{id}.jpg');
    });

    this.createShader('stellar-body-earth', atmosphere_body_vert, earth_frag);

    // Create the earth material.
    let earth_material = new Material(this.scene, 'stellar-body-earth');
    
    let earth = new Spatial(this.scene)
        .setName('body-earth')
        .setData(new MeshData('quadsphere', earth_material));

    let earth_diameter = 12742 * 1000;
    
    earth.scale = vec3.fromValues(earth_diameter, earth_diameter, earth_diameter);

    earth_material
      .setUniforms({
        'uOceanColor': vec3.fromValues(0.02, 0.17, 0.3),
        'uNightColor': vec3.fromValues(1.0, 0.8, 0.6),
        'uNormalCube': 'stellar-body-earth-normal-cube',
        'uLandinfoCube': 'stellar-body-earth-landinfo-cube',
        'uColorCube': 'stellar-body-earth-color-cube',
      });
    
    this.scene.root.add(earth);

    // Create the atmosphere.
    let atmosphere_mesh = new MeshData('atmosphere', this.materials.atmosphere);
    atmosphere_mesh.order = RENDER_ORDER.TRANSPARENT;
    
    let atmosphere = new Spatial(this.scene)
        .setName('atmosphere')
        .setData(atmosphere_mesh);

    let atmosphere_diameter = 1.1;
    
    atmosphere.scale = vec3.fromValues(atmosphere_diameter, atmosphere_diameter, atmosphere_diameter);

    let mie_strength = 200;
    let mie_power = 400;

    // Set up the scaling.
    let atmosphere_scatter_color = vec4.fromValues(10, 20, 40);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 1 / 4);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 15.0);
    atmosphere_scatter_color[3] = mie_power;

    atmosphere.setUniform('uAtmosphereParameters', vec4.fromValues(1 / atmosphere_diameter / 2, 1 / 2, 30, mie_strength));
    atmosphere.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    earth.setUniform('uAtmosphereParameters', vec4.fromValues(1 / 2, atmosphere_diameter / 2, 20, mie_strength));
    earth.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    this.atmosphere = atmosphere;

    earth.add(atmosphere);

    this.bodies.earth = {
      parent: null,
      orbit: new Orbit()
        .setCircularOrbit(149598023 * 1000)
        .setPeriodFromMass(5.972 * Math.pow(10, 24) + 1.98847 * Math.pow(10, 30)),
      spatial: earth,
      body: null
    };

    /*
    this.bodies.moon = {
      parent: this.bodies.earth,
      orbit: new Orbit()
        .setCircularOrbit(149598023 * 1000)
        .setPeriodFromMass(5.972 * Math.pow(10, 24) + 1.98847 * Math.pow(10, 30)),
      spatial: null,
      body: null
    };*/

    /*
    this.spinny = new Spatial(this.scene, 'spinny');
    earth.add(this.spinny);

    let steps = 0;
    for(let i=0; i<steps; i++) {
      let mesh = new Spatial(this.scene, `mesh-${i}`);
      mesh.setData(new MeshData('quadsphere', new Material(this.scene, 'body')));
      mesh.setUniform('uColor', vec3.fromValues(1.0, 1.0, 1.0));

      let angle = (i / steps) * Math.PI * 2;
      let distance = 1;
      
      mesh.position = vec3.fromValues(Math.sin(angle) * distance, 0, Math.cos(angle) * distance);
      mesh.scale = vec3.fromValues(0.1, 0.1, 0.1);

      this.spinny.add(mesh);
    }*/
  }

  createCamera() {
    this.camera_focus = new Spatial(this.scene)
      .setName('-camera-focus');
    
    this.camera = new Spatial(this.scene)
      .setName('-camera')
      .setData(new CameraData(70, 1, 7500000000*1000));

    this.camera.position = vec3.fromValues(0, 0, 0);
    //quat.fromEuler(this.camera.rotation, 90, 0, 0);
    //this.camera.position = vec3.fromValues(0, 0, 10);

    this.camera_focus.add(this.camera);
    this.scene.root.add(this.camera_focus);
    
    this.scene.setCamera(this.camera);

    this.scene.origin = this.camera_focus;

    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
  }

  setFocusBody(name, duration) {
    if(this.input.focus === name) {
      return false;
    }

    if(!(name in this.bodies)) {
      Logger.warn(`Cannot assign non-existent body '${name}' as active body`);
      return false;
    }

    if(duration === undefined || duration === null) {
      duration = 5;
    }

    this.input.focus = name;

    let focus_body = this.getFocusBody().spatial;
    
    this.transition_focus_position.push(new Transition({
      position: name,
      minimum_distance: focus_body.scale[0] / 2 * 1.2 + 20 * 1000
    }, duration * this.transition_focus_position.getCurrentFraction()));

    return true;
  }

  getFocusBody() {
    return this.bodies[this.input.focus];
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

  updateBodyOrbits() {
    for(let body of Object.values(this.bodies)) {
      vec3.copy(body.spatial.position, body.orbit.getPositionAtTime(Date.now() / 1000));
    }
  }
  
  handleUpdateBefore() {
    this.updateBodyOrbits();
    
    this.updateFromInput();
    
    this.atmosphere.setEnabled(this.options.display_atmospheres);

    //let scale = 1000000000000 * 1000;
    //this.scene.scale = vec3.fromValues(1 / scale, 1 / scale, 1 / scale);

    //let position = vec3.create();
    //mat4.getTranslation(position, this.bodies.earth.spatial.modelview_matrix);
    //mat4.getTranslation(position, this.bodies.earth.spatial.world_matrix);

    this.scene.setUniform('uStarPosition', this.scene.transformOrigin(this.bodies.sun.spatial.position));
    
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
