
import Logger from 'js-logger';

import Spatial from './spatial.js';
import Material from './material.js';

// # `Scene`
export default class Scene {

  constructor() {
    this.root = new Spatial(this);
    this._dirty = true;
  }

  setDirty(dirty) {
    this._dirty = dirty;
  }
  
  // TODO: fix naive ordering, add batching.
  draw(renderer) {
    this._dirty = false;
    
    this.root.draw(renderer);
  }
}

