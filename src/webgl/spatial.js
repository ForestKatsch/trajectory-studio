
import {vec3, quat, mat4} from 'gl-matrix';

import Logger from 'js-logger';
import {Uniforms} from './shader.js';
import {RENDER_ORDER} from './scene.js';
import {BLEND, DEPTH} from './material.js';

// # `SpatialData`
//
// Contains extra information and functions for `Spatial` objects.
export class SpatialData {

  constructor() {
    this.scene = null;

    // Specifies the order to draw this in.
    this.order = RENDER_ORDER.AUTO;
  }

  flagDirty() {
    if(this.scene) {
      this.scene.flagDirty();
    } else {
      Logger.warn(`flagDirty() being called for SpatialData, but no scene is bound!`);
    }
  }

  update(renderer, spatial) {
    //
  }

  getRenderSort(spatial) {
    return 0;
  }

  /*
  draw(renderer, spatial) {

  }
  */
  
}

export class MeshData extends SpatialData {

  constructor(mesh_name, material) {
    super();

    this.mesh_name = mesh_name;
    this.material = material;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  getMaterial(spatial) {
    return this.material || (spatial ? spatial.scene.fallback_material : null);
  }

  getRenderSort(spatial) {
    let sort = 0;
    
    let shift = (start, width, value) => {
      if(start > Math.pow(width)) {
        Logger.error(`Cannot shift '${value}' for render sort order; would cause overflow within '${width}'`);
        return 0;
      }
      
      return Math.floor(value) << (start - width);
    };

    // The render sort order is 32 bits, and is partitioned as follows:
    //
    // ```
    // |-------|-------|-------|-------
    // 12345678901234567890123456789012
    //  | order |  mat  |     depth
    // ```
    //
    // If the material is marked as a non-opaque blend mode, the order is instead:
    //
    // ```
    // |-------|-------|-------|-------
    // 12345678901234567890123456789012
    //  | order | depth        |  mat
    // ```

    let material = this.getMaterial(spatial);
    let camera = spatial.scene.camera.getData(CameraData);

    let depth = Math.pow(Math.min(Math.max((-spatial.modelview_matrix[4 * 3 + 2] - camera.near) / (camera.far - camera.near), 0), 1), 0.2) * Math.pow(2, 15);

    sort |= shift(31, 8, this.order);

    if(spatial.order >= RENDER_ORDER.TRANSPARENT) {
      sort |= shift(24, 15, depth);
      sort |= shift(8, 8, material.index);
    } else {
      sort |= shift(24, 8, material.index);
      sort |= shift(16, 15, depth);
    }

    return sort;
  }

  draw(renderer, spatial) {
    //super.draw(renderer, spatial);
    

    //Logger.debug(`Drawing mesh for '${spatial.name}'`);

    let material = this.getMaterial(spatial);
    
    let mesh = renderer.getMesh(this.mesh_name);
    let shader = renderer.getShader(this.material.shader_name);

    if(!mesh) {
      Logger.warn(`MeshInstance for '${spatial.name}' points to non-existent mesh '${this.mesh_name}'`);
      return;
    }
    
    if(!shader) {
      Logger.warn(`MeshInstance for '${spatial.name}' uses material '${material.name}' that uses non-existent shader '${material.shader_name}'`);
      return;
    }
    
    let uniforms = {
      ...spatial.scene.uniforms.get(),
      ...material.uniforms.get(),
      ...(spatial.scene.camera ? spatial.scene.camera.getData(CameraData).uniforms.get() : {}),
      ...spatial.uniforms.get(),
      ...this.uniforms.get(),
    };

    shader.use();
    shader.setUniforms(uniforms);

    renderer.performance.draw_call_count += 1;
    renderer.performance.vertex_count += mesh.vertex_count;

    renderer.setBlendMode(material.blend_mode);
    renderer.setDepthMode(material.depth_mode);

    //Logger.debug(`Drawing object '${spatial.name}'`);
    mesh.draw(shader);
  }
  
  set(name, value) {
    this.uniforms.set(name, value);
  }

}


export class CameraData extends SpatialData {

  constructor(fov, near, far) {
    super();

    this.fov = fov;
    this.near = near;
    this.far = far;

    this.projection_matrix = mat4.create();
    
    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  update(renderer, spatial) {
    super.update(renderer, spatial);
    
    // Transforms from world space to view space.
    this.uniforms.set('uViewMatrix', spatial.world_matrix_inverse);
    
    // Transforms from view space to world space.
    this.uniforms.set('uViewMatrix_i', spatial.world_matrix);
    
    mat4.perspective(this.projection_matrix, this.fov * (Math.PI/180), renderer.size[0] / renderer.size[1], this.near, this.far);
    //mat4.ortho(this.projection_matrix, -10, 10, -10, 10, -10, 10);

    this.uniforms.set('uProjectionMatrix', this.projection_matrix);
  }

}

// # `Spatial`
//
// The `Spatial` class represents an object in 3D space, optionally with a mesh attached.
export default class Spatial {

  constructor(scene, name) {
    // The following variables are all in local space.
    this.position = vec3.create();
    this.rotation = quat.create();
    this.scale = vec3.fromValues(1, 1, 1);

    this.world_matrix = mat4.create();
    this.world_matrix_inverse = mat4.create();
    this.modelview_matrix = mat4.create();
    
    this.scene = scene;

    // Set to false to hide this spatial object and all its children.
    this.enabled = true;
    
    this.name = name;

    this.parent = null;
    this.children = [];

    this.render_sort = 0;
    
    // A `SpatialData` object that can be called upon to perform tasks during update and draw functions.
    this._data = null;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  flagDirty() {
    if(!this.enabled) {
      return;
    }
    
    if(this.parent === null) {
      this.scene.flagDirty();
    } else {
      this.parent.flagDirty();
    }
  }

  // Called before drawing; this function updates the scene tree.
  update(renderer) {
    if(!this.enabled) {
      return;
    }
    
    this.callData('update', renderer, this);

    this.updateMatrices();
    
    for(let child of this.children) {
      child.update(renderer);
    }

  }

  updateRenderSort() {
    if(this._data) {
      this.render_sort = this._data.getRenderSort(this);
    }
  }

  updateMatrices() {
    mat4.fromRotationTranslationScale(this.world_matrix, this.rotation, this.position, this.scale);

    if(this.parent !== null) {
      mat4.multiply(this.world_matrix, this.parent.world_matrix, this.world_matrix);
    }
    
    if(this.scene.camera !== null) {
      mat4.multiply(this.modelview_matrix, this.scene.camera.world_matrix_inverse, this.world_matrix);
    }

    mat4.invert(this.world_matrix_inverse, this.world_matrix);
  }

  // Called before drawing; this function updates the scene tree.
  updatePost(renderer) {
    if(!this.enabled) {
      return;
    }
    
    this.updateMatrices();
    this.updateRenderSort();
    this.updateUniforms();
    
    for(let child of this.children) {
      child.updatePost(renderer);
    }

  }

  updateUniforms() {
    this.uniforms.set('uWorldMatrix', this.world_matrix);
    this.uniforms.set('uWorldMatrix_i', this.world_matrix_inverse);
    this.uniforms.set('uModelViewMatrix', this.modelview_matrix);
  }

  getRenderables() {
    let renderables = [];

    if(this.hasDataFunction('draw') && this.enabled) {
      renderables.push(this);
    }

    for(let child of this.children) {
      renderables.push.apply(renderables, child.getRenderables());
    }

    return renderables;
  }

  draw(renderer, recursive) {
    if(!this.enabled) {
      return;
    }

    this.callData('draw', renderer, this);

    if(recursive) {
      for(let child of this.children) {
        child.draw(renderer, recursive);
      }
    }
  }

  setUniform(name, value) {
    this.uniforms.set(name, value);
  }

  setEnabled(enabled) {
    if(this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    this.flagDirty();
  }

  setData(data) {
    if(data.scene && data.scene !== this.scene) {
      Logger.warn(`Object data for object '${this.name}' cannot be shared across different scenes; reassigning...`);
    }
    
    data.scene = this.scene;

    this._data = data;
  }

  getData(type) {
    if(this._data instanceof type) {
      return this._data;
    }

    return this._data;
  }

  callData(method) {
    if(!this._data) {
      return;
    }

    if(method in this._data) {
      this._data[method].apply(this._data, Array.prototype.slice.call(arguments, 1));
    }
  }
  
  hasDataFunction(method) {
    if(!this._data) {
      return;
    }

    if(method in this._data) {
      return true;
    }

    return false;
  }

  // Adds a child.
  add(child) {
    Logger.debug(`Adding spatial object '${child.name}' to parent '${this.name}'`);
    this.children.push(child);

    if(child.parent !== null) {
      child.parent.remove(child);
    }
    
    child.parent = this;
    
    this.scene.flagDirty();
  }

  remove(child) {
    Logger.error('Not implemented yet');
  }
}

