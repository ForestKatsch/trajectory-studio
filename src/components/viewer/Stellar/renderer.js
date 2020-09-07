
import {vec3, quat, mat4} from 'gl-matrix';

import Renderer from '../../../webgl/renderer.js';
import Scene from '../../../webgl/scene.js';
import Material from '../../../webgl/material.js';
import Spatial, {MeshData, CameraData} from '../../../webgl/spatial.js';

import default_vert from './default.vert';
import default_frag from './default.frag';

import star_frag from './star.frag';
import body_frag from './body.frag';

export default class StellarRenderer extends Renderer {

  create() {
    super.create();

    this.scene = new Scene();

    this.scene.uniforms.set('uStarPosition', vec3.fromValues(0, 0, 0));
    
    //this.createShader('default', default_vert, default_frag);
    this.createShader('body', default_vert, body_frag);
    this.createShader('star', default_vert, star_frag);

    this.createQuadSphere('quadsphere-potato', 2);
    this.createQuadSphere('quadsphere-low', 6);
    this.createQuadSphere('quadsphere-med', 16);
    this.createQuadSphere('quadsphere-high', 24);
    this.createQuadSphere('quadsphere-ultra', 32);

    this.material = new Material(this.scene, 'body');
    
    this.mesh = new Spatial(this.scene, 'mesh');
    this.mesh.setData(new MeshData('quadsphere-ultra', new Material(this.scene, 'star')));
    this.mesh.position = vec3.fromValues(0, 0, -3);

    this.scene.uniforms.set('uColor', vec3.fromValues(1, 0.8, 0.5));
    this.material.set('uColor', vec3.fromValues(1, 1, 1));

    this.spinny = new Spatial(this.scene, 'spinny');
    this.mesh.add(this.spinny);

    let steps = 8;
    for(let i=0; i<steps; i++) {
      let mesh = new Spatial(this.scene, `mesh-${i}`);
      mesh.setData(new MeshData('quadsphere-potato', this.material));

      let angle = (i / steps) * Math.PI * 2;
      let distance = 1;
      
      mesh.position = vec3.fromValues(Math.sin(angle) * distance, 0, Math.cos(angle) * distance);
      mesh.scale = vec3.fromValues(0.1, 0.1, 0.1);

      this.spinny.add(mesh);
    }

    this.camera = new Spatial(this.scene, 'camera');
    this.camera.setData(new CameraData(60, 0.01, 10000));

    this.camera.position = vec3.fromValues(0, 0, 0);

    this.scene.setCamera(this.camera);

    this.scene.root.add(this.camera);
    this.scene.root.add(this.mesh);
    
    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
  }

  // TODO: support triangle strip generation with degenerate triangles.
  // With a `divisions` value of `0`, the sphere will be a cube.
  // With a `divisions` value of `1`, the sphere will have one dividing line.
  // With a `divisions` value of `2`, the sphere will have two dividing lines (16 faces per side.)
  createQuadSphere(name, divisions) {
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
          let y_start = (y / divisions) - 0.5;
          
          let x_end = ((x+1) / divisions) - 0.5;
          let y_end = ((y+1) / divisions) - 0.5;
          
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
      return normal;
    });
    
    mesh.createMesh({
      aPosition: data.position,
      aNormal: data.normal
    }, data._triangles);
  }

  render() {
    let now = Date.now() / 50;
    //this.camera.flagDirty();
    vec3.set(this.mesh.position, Math.sin(now / 32.30) * 0.1, Math.sin(now / 66.30) * 0.1, Math.sin(now / 48.30) * 0.1 - 3);
    //vec3.set(this.camera.position, 0, 0, Math.sin(now / 90.30) * 2);
    
    this.scene.setUniform('uStarPosition', this.mesh.position);
    
    quat.fromEuler(this.mesh.rotation, Math.sin(now / 49.30) * 10, now / 10, Math.sin(now / 300) * 10);
    quat.fromEuler(this.spinny.rotation, 0, now / 1, 0);
    //this.material.set('uColor', [Math.sin(Date.now() / 50), 0, 0]);

    super.render();
  }
  
}
