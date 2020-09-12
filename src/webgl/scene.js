
import Logger from 'js-logger';
import {vec3, mat4} from 'gl-matrix';

import Spatial from './spatial.js';
import Material from './material.js';
import {Uniforms} from './shader.js';

// Render order must always be below 255.
export const RENDER_ORDER = {
  AUTO: 0,
  OPAQUE: 64,
  TRANSPARENT: 128
};

// # `Scene`
export default class Scene {

  constructor() {
    this.root = new Spatial(this, '@root');
    this._dirty = true;

    this.enabled = true;

    this.origin = this.root;

    // 
    this.origin_matrix = mat4.create();
    this.origin_matrix_inverse = mat4.create();

    this.world_matrix = mat4.create();
    this.scale = vec3.fromValues(1, 1, 1);
    
    this.fallback_material = new Material(this, '@fallback');

    // The camera used to render this scene.
    this.camera = null;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  setEnabled(enabled) {
    if(this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    this.flagDirty();
  }

  flagDirty() {
    if(!this.enabled) {
      return;
    }
    
    this._dirty = true;
  }
  
  setCamera(camera) {
    if(camera.scene !== this) {
      Logger.warn(`Cannot set camera '${camera.name}' as default camera for scene it's not in!`);
      return;
    }
    
    this.camera = camera;
    
    this.flagDirty();
  }

  update(renderer) {
    if(!this.enabled) {
      return;
    }

    //this.root.update(renderer);
    //this.root.updatePost(renderer);
    
    //this.origin_matrix = this.origin.matrix;
    //this.origin_matrix_inverse = this.origin.matrix_inverse;
    
    //mat4.fromScaling(this.world_matrix, this.scale);

    if(this.origin.parent !== this.root) {
      Logger.warn(`Origin object '${this.origin.name}' is not a direct child of the scene root object; results may be unexpected`);
    }
    
    vec3.scale(this.root.position, this.origin.position, -1);
    //vec3.set(this.root.position, 0, 10000000, 0);
    
    this.root.update(renderer);
    this.root.updatePost(renderer);
  }

  transformOrigin(position) {
    let transformed = vec3.create();
    vec3.sub(transformed, position, this.origin.position);

    return transformed;
  }

  batch(renderer) {
    let renderables = this.root.getRenderables(renderer);
    
    renderables.sort((a, b) => {
      return a.render_sort - b.render_sort;
    });
    
    return renderables;
  }

  add(child) {
    return this.root.add(child);
  }

  // TODO: fix naive ordering, add batching.
  draw(renderer) {
    this._dirty = false;

    if(!this.enabled) {
      return;
    }
    
    //Logger.debug(`Drawing scene...`);
    
    if(!this.camera) {
      Logger.warn('No camera set in scene, skipping render...');
      return;
    }

    //Logger.debug(`Scene is batched and sorted; drawing ${renderables.length} meshes...`);

    let renderables = this.batch(renderer);

    for(let renderable of renderables) {
      renderable.draw(renderer, false);
    }

    //this.root.draw(renderer, true);
  }
  
  setUniform(name, value) {
    this.uniforms.set(name, value);
  }

}

