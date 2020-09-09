
import {vec3, vec4, quat} from 'gl-matrix';

import Renderer from '../../../webgl/renderer.js';
import Scene, {RENDER_ORDER} from '../../../webgl/scene.js';
import Material, {BLEND, DEPTH} from '../../../webgl/material.js';
import {WRAP} from '../../../webgl/texture.js';
import Spatial, {MeshData, CameraData} from '../../../webgl/spatial.js';

import default_vert from './shaders/default.vert';

import star_frag from './shaders/star.frag';
import earth_frag from './shaders/earth.frag';

import atmosphere_frag from './shaders/atmosphere.frag';

export default class OrreryRenderer extends Renderer {

  init() {
    this.options.desynchronized = true;
    
    super.init();
  }

  create() {
    super.create();

    this.scene = new Scene();

    this.createTexture('stellar-body-earth-landinfo-cube')
      .loadCubemap('static/stellar/bodies/earth/landinfo-{id}.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });
    
    this.createTexture('stellar-body-earth-normal-cube')
      .loadCubemap('static/stellar/bodies/earth/normal-{id}.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });

    setTimeout(() => {
      this.color = this.createTexture('stellar-body-earth-color-cube');
      this.color.loadCubemap('static/stellar/bodies/earth/color-{id}.jpg')
        .setParameters({
          wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
          anisotropy_level: 16
        });
    }, 0);

    this.createShader('earth', default_vert, earth_frag);
    this.createShader('star', default_vert, star_frag);
    
    this.createShader('atmosphere', default_vert, atmosphere_frag);

    this.scene.uniforms.set('uColor', vec3.fromValues(1, 1, 1));
    
    this.createQuadspheres();
    this.createPlanet();
    this.createCamera();

    this.options = {
      ...this.options,
      max_anisotropy_level: 16,
      display_atmospheres: true
    };
  }

  createPlanet() {
    let earth_material = new Material(this.scene, 'earth');
    
    let earth = new Spatial(this.scene, 'earth');
    earth.setData(new MeshData('quadsphere', earth_material));

    let earth_diameter = 12742 * 1000;
    
    earth.scale = vec3.fromValues(earth_diameter, earth_diameter, earth_diameter);

    earth_material.set('uOceanColor', vec3.fromValues(0.02, 0.17, 0.3));
    earth_material.set('uNightColor', vec3.fromValues(0.8, 0.55, 0.4));
    
    earth_material.set('uNormalCube', 'stellar-body-earth-normal-cube');
    earth_material.set('uLandinfoCube', 'stellar-body-earth-landinfo-cube');
    earth_material.set('uColorCube', 'stellar-body-earth-color-cube');
    
    this.scene.root.add(earth);
    
    this.spinny = new Spatial(this.scene, 'spinny');
    earth.add(this.spinny);

    let atmosphere_material = new Material(this.scene, 'atmosphere');
    atmosphere_material.blend_mode = BLEND.ADD;
    atmosphere_material.depth_mode = DEPTH.READ_ONLY;
    
    let atmosphere = new Spatial(this.scene, 'atmosphere');
    let atmosphere_mesh = new MeshData('atmosphere', atmosphere_material)
    atmosphere.setData(atmosphere_mesh);
    atmosphere_mesh.order = RENDER_ORDER.TRANSPARENT;

    let atmosphere_diameter = 1.1;
    
    atmosphere.scale = vec3.fromValues(atmosphere_diameter, atmosphere_diameter, atmosphere_diameter);
    atmosphere.setUniform('uAtmosphereParameters', vec4.fromValues(1 / atmosphere_diameter / 2, 1 / 2, 20, 150));

    let atmosphere_scatter_color = vec4.fromValues(10, 20, 40);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 1 / 4);
    //vec4.pow(atmosphere_scatter_color, atmosphere_scatter_color, 4.0);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 7.0);
    atmosphere_scatter_color[3] = 10;
    
    atmosphere.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    this.atmosphere = atmosphere;

    earth.add(atmosphere);

    this.earth = earth;
    
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
    }
  }

  createCamera() {
    this.camera = new Spatial(this.scene, 'camera');
    this.camera.setData(new CameraData(60, 1, 7500000000*1000));

    this.camera.position = vec3.fromValues(0, 0, this.earth.scale[0] * 1.2);
    //this.camera.position = vec3.fromValues(0, 0, 10);

    this.scene.root.add(this.camera);
    this.scene.setCamera(this.camera);

    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
  }
  
  createQuadspheres() {
    this.createQuadsphere('quadsphere', 32);
    this.createQuadsphere('atmosphere', 8);
  }

  // TODO: support triangle strip generation with degenerate triangles.
  // With a `divisions` value of `0`, the sphere will be a cube.
  // With a `divisions` value of `1`, the sphere will have one dividing line.
  // With a `divisions` value of `2`, the sphere will have two dividing lines (16 faces per side.)
  createQuadsphere(name, divisions, inverted) {
    if(inverted === undefined) {
      inverted = false;
    }

    let sign = 1;

    if(inverted) {
      sign = -1;
    }
    
    divisions = divisions + 2;
    
    let mesh = this.createMesh(name);

    let data = {
      position: [],
      normal: [],
      _triangles: []
    };

    // Returns an object containing two keys: 'position', and 'triangles'.
    // The `vertex_function` is called with parameters `x` and `y`, and the value it returns
    // is directly appended to `vertices`.
    let createFace = (vertex_function) => {
      let d = {
        position: [],
        _triangles: []
      };

      for(let x=0; x<divisions; x++) {
        for(let y=0; y<divisions; y++) {
          let x_start = (x / divisions) - 0.5;
          let y_start = ((y / divisions) - 0.5) * sign;
          
          let x_end = ((x+1) / divisions) - 0.5;
          let y_end = (((y+1) / divisions) - 0.5) * sign;

          d.position.push(vertex_function(x_start, y_start));
          d.position.push(vertex_function(x_start, y_end));
          d.position.push(vertex_function(x_end, y_end));
          d.position.push(vertex_function(x_end, y_start));

          let t_idx = d.position.length - 4;

          d._triangles.push([t_idx + 2, t_idx + 1, t_idx + 0]);
          d._triangles.push([t_idx + 2, t_idx + 0, t_idx + 3]);
        }
      }

      return {
        position: d.position,
        _triangles: d._triangles.flat()
      };
    };

    let xp = createFace((x, y) => {
      return [0.5, x, y];
    });
    
    let xn = createFace((x, y) => {
      return [-0.5, -x, y];
    });

    let yp = createFace((x, y) => {
      return [-x, 0.5, y];
    });
    
    let yn = createFace((x, y) => {
      return [x, -0.5, y];
    });
    
    let zp = createFace((x, y) => {
      return [x, y, 0.5];
    });
    
    let zn = createFace((x, y) => {
      return [-x, y, -0.5];
    });

    let appendData = (a, b) => {
      a._triangles.push.apply(a._triangles, b._triangles.map((value) => {
        return a.position.length + value;
      }));

      for(let key of Object.keys(b)) {
        if(key === '_triangles') {
          continue;
        } else {
          a[key].push.apply(a[key], b[key]);
        }
      }
          
      return a;
    };

    data = appendData(data, xp);
    data = appendData(data, xn);

    data = appendData(data, yp);
    data = appendData(data, yn);

    data = appendData(data, zp);
    data = appendData(data, zn);

    data.position.forEach((position, index) => {
      vec3.normalize(data.position[index], data.position[index]);
      vec3.scale(data.position[index], data.position[index], 0.5);
    });
    
    data.normal = data.position.map((position, index) => {
      let normal = vec3.create();
      vec3.normalize(normal, position);

      if(inverted) {
        vec3.scale(normal, normal, -1);
      }
      
      return normal;
    });
    
    mesh.createMesh({
      aPosition: data.position,
      aNormal: data.normal
    }, data._triangles);
  }

  render() {
    let now = Date.now() / 100;

    this.atmosphere.setEnabled(this.options.display_atmospheres);

    let scale = 1;
    this.scene.scale = vec3.fromValues(1 / scale, 1 / scale, 1 / scale);
    
    this.scene.setUniform('uStarPosition', vec3.fromValues(Math.sin(now / 10.0) * 100000000, 20000000, Math.cos(now / 10.0) *100000000));
    //this.scene.setUniform('uStarPosition', vec3.fromValues(0, 900000000, 300000000));
    this.scene.setUniform('uStarColor', vec3.fromValues(1, 0.95, 0.9));
    quat.fromEuler(this.earth.rotation, 0, now * 0.5, 0);

    this.paused = this.options.paused;

    if(super.render()) {
      this.viewer.setState(state => ({
        stats_fps: this.performance.fps,
        stats_vertex_count: this.performance.vertex_count,
        stats_draw_call_count: this.performance.draw_call_count,
        stats_frame_count: this.performance.current_frame,
      }));
    }
    
    this.viewer.setState(state => ({
      loading: this.isLoading()
    }));
  }
  
}
