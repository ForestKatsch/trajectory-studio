
import {vec3, vec4, quat} from 'gl-matrix';

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

export default class OrreryRenderer extends Renderer {

  init() {
    this.options.desynchronized = true;

    this.input = {
      current_heading: 90,
      current_pitch: 0
    };
    
    super.init();
  }

  create() {
    super.create();

    this.on('updatebefore', this.handleUpdateBefore.bind(this));
    this.on('drawafter', this.handleDrawAfter.bind(this));
    this.on('tickafter', this.handleTickAfter.bind(this));

    this.scene = new Scene();
    
    this.createShaders();
    this.createQuadspheres();
    
    this.createSun();
    this.createEarth();
    this.createCamera();

    this.options = {
      ...this.options,
      max_anisotropy_level: 16,
      display_atmospheres: true
    };
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

  createSun() {
    this.createShader('stellar-body-sun', default_vert, star_frag);

    // Create the earth material.
    let sun_material = new Material(this.scene, 'stellar-body-sun');
    
    this.sun = new Spatial(this.scene)
      .setName('body-sun')
      .setData(new MeshData('quadsphere', sun_material))
      .addTo(this.scene);

    let sun_diameter = 1.3927 * 1000000 * 1000;
    let sun_distance = 149.6 * 1000000 * 1000;

    sun_material.setUniform('uStarColor', vec3.fromValues(1, 0.8, 0.5));
    
    vec3.set(this.sun.scale, sun_diameter, sun_diameter, sun_diameter);
    vec3.set(this.sun.position, 0, 0, sun_distance);
  }

  createEarth() {
    // Get the textures we need.
    this.createTexture('stellar-body-earth-landinfo-cube')
      //.setFallback()
      .loadCubemap('static/stellar/bodies/earth/landinfo-{id}.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });
    
    this.createTexture('stellar-body-earth-color-cube')
      .loadCubemap('static/stellar/bodies/earth/color-{id}.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });

    setTimeout(() => {
      this.createTexture('stellar-body-earth-normal-cube')
        .loadCubemap('static/stellar/bodies/earth/normal-{id}.jpg')
        .setParameters({
          wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
          anisotropy_level: 16
        });
    }, 0);

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
        'uNightColor': vec3.fromValues(0.8, 0.55, 0.4),
        'uNormalCube': 'stellar-body-earth-normal-cube',
        'uLandinfoCube': 'stellar-body-earth-landinfo-cube',
        'uColorCube': 'stellar-body-earth-color-cube',
        'uAtmosphereThickness': 'atmosphere-thickness-lut'
      });
    
    this.scene.root.add(earth);

    let atmosphere_material = new Material(this.scene, 'atmosphere');
    atmosphere_material.blend_mode = BLEND.ADD;
    atmosphere_material.depth_mode = DEPTH.READ_ONLY;

    // Create the atmosphere.
    let atmosphere_mesh = new MeshData('atmosphere', atmosphere_material)
    atmosphere_mesh.order = RENDER_ORDER.TRANSPARENT;
    
    let atmosphere = new Spatial(this.scene)
        .setName('atmosphere')
        .setData(atmosphere_mesh);

    let atmosphere_diameter = 1.1;
    
    atmosphere.scale = vec3.fromValues(atmosphere_diameter, atmosphere_diameter, atmosphere_diameter);

    // Set up the scaling.
    let atmosphere_scatter_color = vec4.fromValues(10, 20, 40);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 1 / 4);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 7.0);
    atmosphere_scatter_color[3] = 10;
    
    atmosphere.setUniform('uAtmosphereParameters', vec4.fromValues(1 / atmosphere_diameter / 2, 1 / 2, 20, 150));
    atmosphere.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    earth.setUniform('uAtmosphereParameters', vec4.fromValues(1 / 2, atmosphere_diameter / 2, 20, 150));
    earth.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    this.atmosphere = atmosphere;

    earth.add(atmosphere);

    this.earth = earth;

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
      .setData(new CameraData(60, 1, 7500000000*1000));

    this.camera.position = vec3.fromValues(0, 0, this.earth.scale[0] * 1.2);
    //this.camera.position = vec3.fromValues(0, 0, 10);

    this.camera_focus.add(this.camera);
    this.scene.root.add(this.camera_focus);
    
    this.scene.setCamera(this.camera);

    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
  }
  
  createQuadspheres() {
    createQuadsphere(this, 'quadsphere', 24);
    createQuadsphere(this, 'atmosphere', 8, true);
  }

  setInputValues(values) {

    // Zoom
    let current_distance = this.camera.position[2];
    let zoom_factor = 0.002;

    let body_radius = this.earth.scale[0] / 2

    let minimum_distance = body_radius * 1.5;

    let distance = current_distance + values.zoom * zoom_factor * (current_distance - body_radius);
    distance = Math.max(distance, minimum_distance);

    this.camera.position = vec3.fromValues(0, 0, distance);

    let heading_factor = 0.3;

    heading_factor *= Math.min((distance - body_radius) / (minimum_distance * 2), 1.0);

    this.input.current_heading += values.heading * heading_factor;
    this.input.current_pitch += values.pitch * heading_factor;
    
    this.input.current_pitch = Math.min(Math.max(this.input.current_pitch, -90), 90);

    //console.log(values.heading);

    quat.fromEuler(this.camera_focus.rotation, this.input.current_pitch, this.input.current_heading, 0);
  }
  
  handleUpdateBefore() {
    //let now = Date.now() / 100;

    this.atmosphere.setEnabled(this.options.display_atmospheres);

    let scale = 1;
    this.scene.scale = vec3.fromValues(1 / scale, 1 / scale, 1 / scale);
    
    //this.scene.setUniform('uStarPosition', vec3.fromValues(Math.sin(now / 10.0) * 100000000, 20000000, Math.cos(now / 10.0) *100000000));
    //this.scene.setUniform('uStarPosition', vec3.fromValues(0, 200000000, 300000000));
    this.scene.setUniform('uStarPosition', this.sun.position);
    
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
