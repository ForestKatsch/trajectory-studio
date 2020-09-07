
import {vec3, quat, mat4} from 'gl-matrix';

import Logger from 'js-logger';
import {Uniforms} from './shader.js';

// # `SpatialData`
//
// Contains extra information and functions for `Spatial` objects.
export class SpatialData {

  constructor() {
    this.scene = null;
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

  draw(renderer, spatial) {
    //
  }
  
}

export class MeshData extends SpatialData {

  constructor(mesh_name, material) {
    super();

    this.mesh_name = mesh_name;
    this.material = material;
    
    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  draw(renderer, spatial) {
    super.draw(renderer, spatial);

    //Logger.debug(`Drawing mesh for '${spatial.name}'`);

    let material = this.material;

    if(material === null) {
      material = spatial.scene.fallback_material;
    }
    
    let mesh = renderer.meshes[this.mesh_name];
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
      ...(spatial.scene.camera ? spatial.scene.camera.data.uniforms.get() : {}),
      ...spatial.uniforms.get(),
      ...this.uniforms.get(),
    };

    shader.use();
    shader.setUniforms(uniforms);
    
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
    
    // Transforms from world space to view space.
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

    // A `SpatialData` object that can be called upon to perform tasks during update and draw functions.
    this.data = null;

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

  callData(method) {
    if(!this.data) {
      return;
    }

    if(method in this.data) {
      this.data[method].apply(this.data, Array.prototype.slice.call(arguments, 1));
    }
  }

  // Called before drawing; this function updates the scene tree.
  update(renderer) {
    if(!this.enabled) {
      return;
    }
    
    this.callData('update', renderer, this);

    mat4.fromRotationTranslationScale(this.world_matrix, this.rotation, this.position, this.scale);

    if(this.parent !== null) {
      mat4.multiply(this.world_matrix, this.parent.world_matrix, this.world_matrix);
    }
    
    if(this.scene.camera !== null) {
      mat4.multiply(this.modelview_matrix, this.scene.camera.world_matrix_inverse, this.world_matrix);
    }

    mat4.invert(this.world_matrix_inverse, this.world_matrix);
    this.uniforms.set('uModelMatrix_i', this.world_matrix);
    
    this.uniforms.set('uWorldMatrix', this.world_matrix);
    this.uniforms.set('uModelViewMatrix', this.modelview_matrix);
    
    for(let child of this.children) {
      child.update(renderer);
    }
  }

  draw(renderer) {
    if(!this.enabled) {
      return;
    }

    this.callData('draw', renderer, this);

    for(let child of this.children) {
      child.draw(renderer);
    }
  }

  set(name, value) {
    this.uniforms.set(name, value);
  }

  setData(data) {
    if(data.scene && data.scene !== this.scene) {
      Logger.warn(`Object data for object '${this.name}' cannot be shared across different scenes; reassigning...`);
    }
    
    data.scene = this.scene;

    this.data = data;
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

