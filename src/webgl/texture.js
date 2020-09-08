
import {vec4} from 'gl-matrix';

import {TYPE} from './shader.js';
import {Asset, STATE} from './loader.js';
import Logger from 'js-logger';

// # `Texture`
//
// A single texture.
// TODO: needs huge cleanups for better support.
export default class Texture extends Asset {

  constructor(renderer, name) {
    super(name);
    
    this.renderer = renderer;

    this.type = TYPE.TEXTURE_2D;
    
    // HTML image.
    this.image = null;

    // WebGL texture ID.
    this.texture = null;
  }

  isReady() {
    return this.isLoaded();
  }

  init() {
    const gl = this.renderer.context;
    
    this.texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    this.setFromColor(vec4.fromValues(1, 0, 1, 1));
  }

  // `Color` is a vec4 with RGBA.
  setFromColor(color) {
    const gl = this.renderer.context;
    
    const format = gl.RGBA;
    
    const width = 1;
    const height = 1;

    vec4.scale(color, color, 255);
    
    const data = new Uint8Array(color);
    
    gl.texImage2D(this.getGLTextureType(), 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, data);
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
  }

  // Assigns the image to WebGL.
  assignImage() {
    Logger.info(`Assigning image '${this.name}' to WebGL texture.`);
    const gl = this.renderer.context;
    
    const level = 0;
    const internalFormat = gl.RGB;
    const srcFormat = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;
    
    gl.bindTexture(this.getGLTextureType(), this.texture);
    gl.texImage2D(this.getGLTextureType(), level, internalFormat, srcFormat, srcType, this.image);

    gl.generateMipmap(this.getGLTextureType());
    gl.texParameteri(this.getGLTextureType(), gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(this.getGLTextureType(), gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  handleImageLoad() {
    this.assignImage();
    
    this.setState(STATE.LOAD_COMPLETE);
  }

  handleImageError(e) {
    Logger.warn(`Image '${this.image.src}' could not be fetched.`, e);
    this.setState(STATE.LOAD_ERROR);
  }
}
