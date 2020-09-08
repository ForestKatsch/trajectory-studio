
import {vec3, vec4, quat} from 'gl-matrix';

import Renderer from '../../../webgl/renderer.js';
import Scene from '../../../webgl/scene.js';
import Material, {BLEND, DEPTH} from '../../../webgl/material.js';
import {WRAP} from '../../../webgl/texture.js';
import Spatial, {MeshData, CameraData} from '../../../webgl/spatial.js';

import default_vert from './default.vert';
//import default_frag from './default.frag';

import star_frag from './star.frag';
import body_frag from './body.frag';

import atmosphere_vert from './atmosphere.vert';
import atmosphere_frag from './atmosphere.frag';

export default class StellarRenderer extends Renderer {

  init() {
    this.options.desynchronized = true;
    
    super.init();
  }

  create() {
    super.create();

    this.scene = new Scene();

    this.createTexture('stellar-body-earth-landinfo')
      .load('static/stellar/bodies/earth/earth.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });
    this.createTexture('stellar-body-earth-color')
      .load('static/stellar/bodies/earth/color.jpg')
      .setParameters({
        wrap: [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE],
        anisotropy_level: 16
      });

    //this.createShader('default', default_vert, default_frag);
    this.createShader('body', default_vert, body_frag);
    this.createShader('star', default_vert, star_frag);
    
    let shader = this.createShader('atmosphere', atmosphere_vert, atmosphere_frag);

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
    let earth_material = new Material(this.scene, 'body');
    
    let earth = new Spatial(this.scene, 'earth');
    earth.setData(new MeshData('quadsphere', earth_material));

    earth_material.set('uLandColor', vec3.fromValues(0.5, 0.8, 0.6));
    earth_material.set('uOceanColor', vec3.fromValues(0.02, 0.17, 0.3));
    earth_material.set('uNightColor', vec3.fromValues(0.8, 0.55, 0.4));
    
    earth_material.set('uLandinfo', 'stellar-body-earth-landinfo');
    earth_material.set('uTexture', 'stellar-body-earth-color');
    
    this.scene.root.add(earth);
    
    this.spinny = new Spatial(this.scene, 'spinny');
    earth.add(this.spinny);

    let atmosphere_material = new Material(this.scene, 'atmosphere');
    atmosphere_material.blend_mode = BLEND.ADD;
    atmosphere_material.depth_mode = DEPTH.READ_ONLY;
    
    let atmosphere = new Spatial(this.scene, 'atmosphere');
    atmosphere.setData(new MeshData('atmosphere', atmosphere_material));
    
    atmosphere.scale = vec3.fromValues(1.1, 1.1, 1.1);
    atmosphere.setUniform('uAtmosphereParameters', vec4.fromValues(1 / 1.1 / 2, 1 / 2, 30, 1000));

    let atmosphere_scatter_color = vec4.fromValues(10, 20, 40);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 1 / 4);
    //vec4.pow(atmosphere_scatter_color, atmosphere_scatter_color, 4.0);
    vec4.scale(atmosphere_scatter_color, atmosphere_scatter_color, 4.0);
    atmosphere_scatter_color[3] = 50;
    
    atmosphere.setUniform('uAtmosphereRaleighScatter', atmosphere_scatter_color);

    this.atmosphere = atmosphere;

    earth.add(atmosphere);

    this.earth = earth;
    
    let steps = 32;
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
    this.camera.setData(new CameraData(60, 0.01, 10000));

    this.camera.position = vec3.fromValues(0, 0, 2);

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
    //this.(this.options.display_atmospheres);
    
    //this.camera.flagDirty();
    //vec3.set(this.body.position, Math.sin(now / 32.30) * 0.5, Math.sin(now / 66.30) * 0.5, 0);
    //vec3.set(this.camera.position, 0, 0, Math.sin(now / 15) * 3 + 5);
    
    //this.scene.setUniform('uStarPosition', this.mesh.position);
    
    this.scene.uniforms.set('uStarPosition', vec3.fromValues(Math.sin(now / 10.0) *100, 20, Math.cos(now / 10.0) *100));
    //this.scene.uniforms.set('uStarPosition', vec3.fromValues(100, 40, 100));
    //this.scene.uniforms.set('uStarPosition', vec3.fromValues(0, 50, -100));
    
    //quat.fromEuler(this.earth.rotation, Math.sin(now / 7) * 30, 0, Math.sin(now / 7) * 30);
    quat.fromEuler(this.earth.rotation, 30, now * 3, 0);
    //quat.fromEuler(this.spinny.rotation, 0, 220, 0);
    //this.material.set('uColor', [Math.sin(Date.now() / 50), 0, 0]);

    if(super.render()) {
      this.viewer.setState(state => ({
        stats_fps: this.performance.fps,
        stats_vertex_count: this.performance.vertex_count,
        stats_draw_call_count: this.performance.draw_call_count,
        stats_frame_count: this.performance.current_frame,
      }));
    }
    
  }
  
}
