
import Logger from 'js-logger';

export default class Material {

  constructor(scene, shader_name) {
    this.scene = scene;
    
    this.shader_name = shader_name;

    this._uniforms = {};
  }

  set(uniform_name, value) {
    this.scene.setDirty(true);
    
    this._uniforms[uniform_name] = value;
  }

}
