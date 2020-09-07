
import {vec3, quat, mat4} from 'gl-matrix';

import Renderer from '../../../webgl/renderer.js';
import Scene from '../../../webgl/scene.js';
import Material from '../../../webgl/material.js';
import Spatial, {MeshData, CameraData} from '../../../webgl/spatial.js';

import default_vert from './default.vert';
import default_frag from './default.frag';

export default class StellarRenderer extends Renderer {

  create() {
    super.create();

    this.scene = new Scene();

    this.createShader('default', default_vert, default_frag);

    this.createQuadSphere('quadsphere-8', 24);

    this.material = new Material(this.scene, 'default');
    
    this.mesh = new Spatial(this.scene, 'mesh');
    this.mesh.setData(new MeshData('quadsphere-8', this.material));
    this.mesh.position = vec3.fromValues(0, 0, -3);

    this.camera = new Spatial(this.scene, 'camera');
    this.camera.setData(new CameraData(90, 0.01, 10000));

    this.camera.position = vec3.fromValues(0, 0, 0);

    this.scene.setCamera(this.camera);

    this.scene.root.add(this.camera);
    this.scene.root.add(this.mesh);
  }

  // TODO: support triangle strip generation with degenerate triangles.
  // With a `divisions` value of `0`, the sphere will be a cube.
  // With a `divisions` value of `1`, the sphere will have one dividing line.
  // With a `divisions` value of `2`, the sphere will have two dividing lines (16 faces per side.)
  createQuadSphere(name, divisions) {
    divisions = divisions + 1;
    
    let mesh = this.createMesh(name);

    let data = {
      position: [],
      triangles: []
    };

    // Returns an object containing two keys: 'position', and 'triangles'.
    // The `vertex_function` is called with parameters `x` and `y`, and the value it returns
    // is directly appended to `vertices`.
    let createFace = (vertex_function) => {
      let d = {
        position: [],
        triangles: []
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

          d.triangles.push([t_idx + 2, t_idx + 1, t_idx + 0]);
          d.triangles.push([t_idx + 2, t_idx + 0, t_idx + 3]);
        }
      }

      return {
        position: d.position,
        triangles: d.triangles.flat()
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
      a['triangles'].push.apply(a['triangles'], b['triangles'].map((value) => {
        return a['position'].length + value;
      }));

      for(let key of Object.keys(b)) {
        if(key === 'triangles') {
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
    });
    
    mesh.createMesh({
      aPosition: data.position
    }, data.triangles);
  }

  render() {
    //this.camera.flagDirty();
    quat.fromEuler(this.mesh.rotation, 0, Date.now() / 10, 0);
    //this.material.set('uColor', [Math.sin(Date.now() / 50), 0, 0]);

    super.render();
  }
  
}
