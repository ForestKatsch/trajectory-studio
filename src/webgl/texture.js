
import {vec4} from 'gl-matrix';

import {TYPE} from './shader.js';
import {Asset, STATE} from './loader.js';
import Logger from 'js-logger';

export const WRAP = {
  REPEAT: 0x2901,
  CLAMP_TO_EDGE: 0x812F,
  MIRRORED_REPEAT: 0x8370,
};

export const FILTER = {
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  NEAREST_MIPMAP_NEAREST: 0x2700,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  LINEAR_MIPMAP_LINEAR: 0x2703,
}

// # `Texture`
//
// A single texture.
// TODO: needs huge cleanups for better support.
export default class Texture extends Asset {

  constructor(renderer, name, parameters) {
    super(name);

    if(!parameters) {
      parameters = {};
    }
    
    this.renderer = renderer;

    this.type = TYPE.TEXTURE_2D;
    
    // HTML image.
    this.image = null;

    // WebGL texture ID.
    this.texture = null;

    this.parameters = {
      min_filter: FILTER.LINEAR_MIPMAP_LINEAR,
      mag_filter: FILTER.LINEAR,
      wrap: [WRAP.REPEAT, WRAP.REPEAT],
      anisotropy_level: 0,
      ...parameters
    };
  }

  isReady() {
    return this.isLoaded();
  }

  init() {
    const gl = this.renderer.context;
    
    this.texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    this._setFromColor(vec4.fromValues(1, 0, 1, 1));
  }
  
  _setFromColor(color) {
    const gl = this.renderer.context;
    
    const format = gl.RGBA;
    
    const width = 1;
    const height = 1;

    vec4.scale(color, color, 255);
    
    const data = new Uint8Array(color);
    
    gl.texImage2D(this.getGLTextureType(), 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, data);
    
  }

  // `Color` is a vec4 with RGBA.
  setFromColor(color) {
    this.setState(STATE.LOADING);
    this._setFromColor(color);
    this.setState(STATE.LOAD_COMPLETE);
  }

  getGLTextureType() {
    const gl = this.renderer.context;
    
    switch(this.type) {
    case TYPE.TEXTURE_2D:
      return gl.TEXTURE_2D;
    default:
      Logger.warn(`Texture '${this.name}' has an unknown type '${this.type}'`);
      return null;
    }
  }

  deinit() {
    const gl = this.renderer.context;

    gl.deleteTexture(this.texture);
  }

  load(url) {
    if(this.image !== null) {
      Logger.warn(`Texture '${this.name}' already has an image assigned, skipping download of '${url}'.`);
      return;
    }
    
    Logger.info(`Fetching image '${url}' for '${this.name}'.`);
    
    this.setState(STATE.LOADING);
    
    this.image = new Image();
    this.image.onload = this.handleImageLoad.bind(this);
    this.image.onerror = this.handleImageError.bind(this);
    this.image.src = url;

    return this;
  }

  setParameters(parameters) {
    this.parameters = {
      ...this.parameters,
      ...parameters
    };

    this.applyParameters();
  }

  // Assigns the image to WebGL.
  assignImage() {
    Logger.info(`Assigning image '${this.name}' to WebGL texture.`);
    const gl = this.renderer.context;
    
    const internalFormat = gl.RGB;
    const srcFormat = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;

    const type = this.getGLTextureType();
    
    gl.bindTexture(type, this.texture);
    gl.texImage2D(type, 0, internalFormat, srcFormat, srcType, this.image);

    gl.generateMipmap(type);

    this.applyParameters();
  }

  applyParameters() {
    if(!this.isLoaded()) {
      return;
    }

    const gl = this.renderer.context;
    const type = this.getGLTextureType();
    
    gl.bindTexture(type, this.texture);
    
    gl.texParameteri(type, gl.TEXTURE_WRAP_S, this.parameters.wrap[0]);
    gl.texParameteri(type, gl.TEXTURE_WRAP_T, this.parameters.wrap[1]);
    
    gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, this.parameters.min_filter);
    gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, this.parameters.mag_filter);

    if(this.parameters.anisotropy_level) {
      this.applyParameterAnisotropy();
    }
  }

  applyParameterAnisotropy() {
    const gl = this.renderer.context;
    const type = this.getGLTextureType();
    
    let aniso_ext = this.renderer.getExtension('EXT_texture_filter_anisotropic');

    if(!aniso_ext) {
      return;
    }

    let level = Math.min(
      this.parameters.anisotropy_level,
      (this.renderer.options.max_anisotropy_level === undefined ? 32 : this.renderer.options.max_anisotropy_level),
      aniso_ext.max,
    );

    //Logger.debug(`Setting anisotropy level to '${level}' for '${this.name}'`);

    gl.texParameterf(type, aniso_ext.ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(level, 1));
  };

  bind() {
    this.applyParameters();
  }

  handleImageLoad() {
    this.setState(STATE.LOAD_COMPLETE);
    
    this.assignImage();
  }

  handleImageError(e) {
    Logger.warn(`Image '${this.image.src}' could not be fetched.`, e);
    this.setState(STATE.LOAD_ERROR);
  }
}
