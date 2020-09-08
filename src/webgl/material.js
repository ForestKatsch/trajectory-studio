
//import Logger from 'js-logger';

import {Uniforms} from './shader.js';

export const BLEND = {
  OPAQUE: 0,
  ADD: 1
};

export const DEPTH = {
  IGNORE: 0,
  READ_ONLY: 1,
  READ_WRITE: 2,
};

let current_material_index = 0;

export default class Material {

  constructor(scene, shader_name) {
    this.scene = scene;
    
    this.shader_name = shader_name;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
    
    this.blend_mode = BLEND.OPAQUE;
    this.depth_mode = DEPTH.READ_WRITE;
    
    this.index = current_material_index++;
  }

  flagDirty() {
    this.scene.flagDirty();
  }

  set(name, value) {
    this.uniforms.set(name, value);
  }

}
