
import Logger from 'js-logger';

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
    
    this.root.update(renderer);
    this.root.updatePost(renderer);
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

