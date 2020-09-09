
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

    this.type = null;
    
    // HTML image(s)
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
    //this._setFromColor(vec4.fromValues(1, 0, 1, 1));
  }
  
  // `Color` is a vec4 with RGBA.
  setFromColor(color) {
    this.setFromColorInit(TYPE.TEXTURE_2D);
    
    const gl = this.renderer.context;
    
    const format = gl.RGBA;
    
    const width = 1;
    const height = 1;

    vec4.scale(color, color, 255);
    
    const data = new Uint8Array(color);

    let type = this.getGLTextureType();
    
    gl.bindTexture(type, this.texture);
    gl.texImage2D(type, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, data);
    
    this.setState(STATE.LOAD_COMPLETE);
  }

  setFromColorInit(type) {
    this.type = type;
    this.setState(STATE.LOADING);
    
    const gl = this.renderer.context;
    gl.bindTexture(this.type, this.texture);
  }
  
  setFromColorCubemap(color) {
    this.setFromColorInit(TYPE.TEXTURE_CUBE_MAP);
    
    const gl = this.renderer.context;
    
    vec4.scale(color, color, 255);
    
    const data = new Uint8Array(color);

    let type = this.getGLTextureType();
    
    const targets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    targets.forEach((target, index) => {
      const level = 0;
      const format = gl.RGB;
      const type = gl.UNSIGNED_BYTE;
      
      gl.texImage2D(target, 0, format, 1, 1, 0, format, type, data);
    });
    
    this.setState(STATE.LOAD_COMPLETE);
  }

  getGLTextureType() {
    return this.type;
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
    
    Logger.info(`Fetching image '${url}' for texture '${this.name}'.`);

    this.type = TYPE.TEXTURE_2D;
    
    this.setState(STATE.LOADING);
    
    this.image = new Image();
    this.image.onload = this.handleImageLoad.bind(this);
    this.image.onerror = this.handleImageError.bind(this);
    this.image.src = url;

    return this;
  }

  loadCubemap(url) {
    if(typeof url !== typeof '') {
      Logger.warn(`loadCubemap() must be called with a string URL (at the moment)`);
    }

    if(this.image !== null) {
      Logger.warn(`Texture '${this.name}' already has an image assigned, skipping download of '${url}'.`);
      return;
    }
    
    let urls = [];

    for(let i=0; i<6; i++) {
      urls.push(url.replace('{id}', i.toString().padStart(4, '0')));
    }

    this.loadCubemapFaces(urls);

    return this;
  }

  loadCubemapFaces(urls) {
    this.type = TYPE.TEXTURE_CUBE_MAP;
    
    this.setState(STATE.LOADING);
    
    this.image = [];

    for(let url of urls) {
      Logger.info(`Fetching image '${url}' for cubemap '${this.name}'.`);
      
      let image = new Image();
      image.onload = this.handleImageLoad.bind(this);
      image.onerror = this.handleImageError.bind(this);
      image.src = url;

      this.image.push(image);
    }
  }

  setParameters(parameters) {
    this.parameters = {
      ...this.parameters,
      ...parameters
    };

    this.applyParameters();

    return this;
  }

  // Assigns the image to WebGL.
  assignImage() {
    const gl = this.renderer.context;
    const type = this.getGLTextureType();
    
    gl.bindTexture(type, this.texture);
    
    if(this.type === TYPE.TEXTURE_CUBE_MAP) {
      this.assignCubemap();
    } else {
      this.assign2D();
    }

    gl.generateMipmap(type);
    
    this.applyParameters();
  }

  assign2D() {
    const gl = this.renderer.context;
    const type = this.getGLTextureType();
    
    const format = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;

    gl.texImage2D(type, 0, format, format, srcType, this.image);
  }

  assignCubemap() {
    Logger.info(`Assigning image '${this.name}' to WebGL cubemap texture.`);
    
    const gl = this.renderer.context;
    
    const targets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    this.image.forEach((image, index) => {
      const level = 0;
      const format = gl.RGB;
      const type = gl.UNSIGNED_BYTE;
      
      gl.texImage2D(targets[index], 0, format, format, type, image);
    });
  }

  applyParameters() {
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

  handleImageLoad(e) {
    e.target._loaded = true;
    
    if(this.type === TYPE.TEXTURE_CUBE_MAP) {
      for(let image of this.image) {
        if(!image._loaded) {
          return;
        }
      }
    }

    if(this.state === STATE.LOAD_ERROR) {
      return;
    }
    
    this.assignImage();

    this.setState(STATE.LOAD_COMPLETE);
  }

  handleImageError(e) {
    Logger.warn(`Image '${e.target.src}' could not be fetched.`, e);
    
    this.setState(STATE.LOAD_ERROR);
  }
}
