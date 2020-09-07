
//import Logger from 'js-logger';

import {Uniforms} from './shader.js';

export default class Material {

  constructor(scene, shader_name) {
    this.scene = scene;
    
    this.shader_name = shader_name;

    this.uniforms = new Uniforms(this.flagDirty.bind(this));
  }

  flagDirty() {
    this.scene.flagDirty();
  }

  set(name, value) {
    this.uniforms.set(name, value);
  }

}
