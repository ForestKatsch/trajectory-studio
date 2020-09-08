
import Logger from 'js-logger';

import Spatial from './spatial.js';
import Material from './material.js';
import {Uniforms} from './shader.js';

export const RENDER_ORDER = {
  AUTO: 0,
  OPAQUE: 1000,
  TRANSPARENT: 3000
};

// # `Scene`
export default class Scene {

  constructor() {
    this.root = new Spatial(this, '@root');
    this._dirty = true;

    this.fallback_material = new Material(this, '@fallback');

    // The camera used to render this scene.
    this.camera = null;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  flagDirty() {
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
    this.root.update(renderer);
    this.root.update(renderer);
  }

  // TODO: fix naive ordering, add batching.
  draw(renderer) {
    //Logger.debug(`Drawing scene...`);
    
    this._dirty = false;

    if(!this.camera) {
      Logger.warn('No camera set in scene, skipping render...');
      return;
    }

    this.root.draw(renderer);
  }
  
  setUniform(name, value) {
    this.uniforms.set(name, value);
  }

}

