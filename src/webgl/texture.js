
import {vec2, vec3, vec4} from 'gl-matrix';

import {TYPE} from './shader.js';
import {flatten} from './mesh.js';
import {Asset, STATE} from './loader.js';
import Logger from 'js-logger';

export const WRAP = {
  REPEAT: 0x2901,
  CLAMP_TO_EDGE: 0x812F,
  MIRRORED_REPEAT: 0x8370,
};

export const FORMAT = {
  DEPTH_COMPONENT: 0x1902,
  ALPHA: 0x1906,
  RGB: 0x1907,
  RGBA: 0x1908,
  LUMINANCE: 0x1909,
  LUMINANCE_ALPHA: 0x190A
};

export const FILTER = {
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  NEAREST_MIPMAP_NEAREST: 0x2700,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  LINEAR_MIPMAP_LINEAR: 0x2703,
}

const CUBEMAP_TARGETS = [
  0x8515,
  0x8516,
  0x8517,
  0x8518,
  0x8519,
  0x851A,
];

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

    this.fallback = null;

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

  bind() {
    this.renderer.context.bindTexture(this.type, this.texture);
  }

  init() {
    const gl = this.renderer.context;

    this.texture = gl.createTexture();
    //this._setFromColor(vec4.fromValues(1, 0, 1, 1));
  }

  setFallback(fallback) {
    this.fallback = fallback;

    return this;
  }

  // `Color` is a vec4 with RGBA.
  setFromColor(color) {
    const gl = this.renderer.context;
    vec4.scale(color, color, 255);
    return this.setFromData(1, 1, gl.RGBA, new Uint8Array(color));
  }

  setFromData(width, height, format, data) {
    const gl = this.renderer.context;

    this.type = TYPE.TEXTURE_2D;
    this.setState(STATE.LOADING);

    this.bind();

    gl.texImage2D(this.type, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(this.type);

    this.applyParameters();

    this.setState(STATE.LOAD_COMPLETE);

    return this;
  }

  setFromDataCubemap(size, format, data_faces) {
    const gl = this.renderer.context;

    this.type = TYPE.TEXTURE_CUBE_MAP;
    this.setState(STATE.LOADING);

    this.bind();

    CUBEMAP_TARGETS.forEach((target, index) => {
      const type = gl.UNSIGNED_BYTE;

      gl.texImage2D(target, 0, format, size, size, 0, format, type, data_faces[index]);
    });

    gl.generateMipmap(this.type);

    this.parameters.wrap = [
      WRAP.CLAMP_TO_EDGE,
      WRAP.CLAMP_TO_EDGE
    ];

    this.applyParameters();

    this.setState(STATE.LOAD_COMPLETE);

    return this;
  }

  // Writes the same data to each face.
  setFromSameDataCubemap(size, format, data) {
    return this.setFromDataCubemap(size, format, [data, data, data, data, data, data]);
  }

  // `Shader` is a function that is given `x` and `y` coordinates as a `vec2`, and returns a `vec4`
  // as RGBA 0..1.
  setFromShader(width, height, shader) {
    let data = [];

    let coordinates = vec2.create();
    let color = vec4.create();

    for(let i=0; i<width*height; i++) {
      vec2.set(coordinates, (i % width) / width, (Math.floor(i / width)) / width);

      color = shader(coordinates);
      vec4.scale(color, color, 255);

      data.push.apply(data, color);
    }

    const gl = this.renderer.context;

    return this.setFromData(width, height, gl.RGBA, new Uint8Array(data));
  }

  createCheckerData(colora, colorb, size, cell_size) {
    vec4.scale(colora, colora, 255);
    vec4.scale(colorb, colorb, 255);

    let data = [];

    for(let i=0; i<size*size; i++) {
      let x = i % size;
      let y = Math.floor(i / size);

      var x_cell = Math.floor(x / (size / cell_size));
      var y_cell = Math.floor(y / (size / cell_size));

      if((x_cell + y_cell) % 2 === 0) {
        data.push(colora);
      } else {
        data.push(colorb);
      }
    }

    return flatten(data);
  }

  setCheckerFromColor(colora, colorb, size, checkers) {
    const gl = this.renderer.context;

    return this.setFromData(size, size, gl.RGBA, new Uint8Array(this.createCheckerData(colora, colorb, size, checkers)));
  }

  setFromColorCubemap(color) {
    const gl = this.renderer.context;

    vec4.scale(color, color, 255);

    return this.setFromSameDataCubemap(1, gl.RGBA, new Uint8Array(flatten(color)));
  }

  setFromCheckerCubemap(colora, colorb, size, cell_size) {
    const gl = this.renderer.context;

    const data = new Uint8Array(this.createCheckerData(colora, colorb, size, cell_size));

    this.parameters.min_filter = FILTER.NEAREST;
    this.parameters.mag_filter = FILTER.NEAREST;

    this.setFromSameDataCubemap(size, gl.RGBA, new Uint8Array(flatten(data)));

    return this;
  }

  setFromShaderCubemap(size, format, shader) {

    let createFace = (swizzle) => {
      let data = [];

      let coordinates = vec2.create();
      let coordinates_3d = vec3.create();
      let color = vec4.create();

      for(let i=0; i<size*size; i++) {
        vec2.set(coordinates, ((i % size) / size) * 2 - 1, ((Math.floor(i / size)) / size) * 2 - 1);

        coordinates_3d = swizzle(coordinates);
        vec3.normalize(coordinates_3d, coordinates_3d);

        color = shader(coordinates_3d);
        vec4.scale(color, color, 255);

        color[0] = Math.min(Math.max(color[0], 0), 255);
        color[1] = Math.min(Math.max(color[1], 0), 255);
        color[2] = Math.min(Math.max(color[2], 0), 255);
        color[3] = Math.min(Math.max(color[3], 0), 255);

        switch(format) {
        case FORMAT.RGB:
          data.push.call(data, color[0], color[1], color[2]);
          break;
        case FORMAT.RGBA:
          data.push.apply(data, color);
          break;
        case FORMAT.ALPHA:
          data.push(color[4]);
          break;
        case FORMAT.LUMINANCE:
          data.push(color[0]);
          break;
        case FORMAT.LUMINANCE_ALPHA:
        default:
          data.push.call(data, color[0], color[4]);
          break;
        }

      }

      return new Uint8Array(data);
    };

    const data = [
      createFace((c) => vec3.fromValues(1, -c[1], -c[0])),
      createFace((c) => vec3.fromValues(-1, -c[1], c[0])),
      createFace((c) => vec3.fromValues(c[0], 1, c[1])),
      createFace((c) => vec3.fromValues(c[0], -1, -c[1])),
      createFace((c) => vec3.fromValues(c[0], -c[1], 1)),
      createFace((c) => vec3.fromValues(-c[0], -c[1], -1)),
    ];

    return this.setFromDataCubemap(size, format, data);
  }

  getGLTextureType() {
    return this.type;
  }

  deinit() {
    const gl = this.renderer.context;

    gl.deleteTexture(this.texture);
  }

  load(url) {
    if(this.type !== null) {
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

    if(this.type !== null) {
      Logger.warn(`Texture '${this.name}' already has an image assigned, skipping download of '${url}'.`);
      return;
    }

    let urls = [];

    for(let i=0; i<6; i++) {
      urls.push(url.replace('{id}', i.toString().padStart(4, '0')));
    }

    this.loadCubemapFacesFromURL(urls);

    return this;
  }

  // Given a list of image URLs, load all of them.
  loadCubemapFacesFromURL(urls) {
    this.type = TYPE.TEXTURE_CUBE_MAP;

    this.setState(STATE.LOADING);

    this.images = [];

    this.images = urls.map((url, index) => {
      Logger.info(`Fetching image '${url}' for cubemap '${this.name}'.`);

      let image = new Image();

      image.onload = () => {
        this.handleCubemapImageLoad(index);
      };

      image.onerror = this.handleImageError.bind(this);
      image.src = url;

      return {
        image: image,
        loaded: false,
        index: index
      };
    });
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

    this.bind();

    if(this.type === TYPE.TEXTURE_CUBE_MAP) {
      this.assignCubemap();
    } else {
      this.assign2D();
    }

    gl.generateMipmap(this.type);

    this.applyParameters();
  }

  assign2D() {
    const gl = this.renderer.context;

    const format = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;

    gl.texImage2D(this.type, 0, format, format, srcType, this.image);
  }

  assignCubemap() {
    Logger.info(`Assigning image '${this.name}' to WebGL cubemap texture.`);

    const gl = this.renderer.context;

    this.parameters.wrap = [WRAP.CLAMP_TO_EDGE, WRAP.CLAMP_TO_EDGE];

    this.images.forEach((info) => {
      const format = gl.RGB;
      const type = gl.UNSIGNED_BYTE;

      gl.texImage2D(CUBEMAP_TARGETS[info.index], 0, format, format, type, info.image);
    });
  }

  applyParameters() {
    const gl = this.renderer.context;

    if(this.type === null) {
      return;
    }

    this.bind();

    gl.texParameteri(this.type, gl.TEXTURE_WRAP_S, this.parameters.wrap[0]);
    gl.texParameteri(this.type, gl.TEXTURE_WRAP_T, this.parameters.wrap[1]);

    gl.texParameteri(this.type, gl.TEXTURE_MIN_FILTER, this.parameters.min_filter);
    gl.texParameteri(this.type, gl.TEXTURE_MAG_FILTER, this.parameters.mag_filter);

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

  handleImageLoad() {
    this.assignImage();

    this.setState(STATE.LOAD_COMPLETE);
  }

  handleCubemapImageLoad(index) {
    this.images[index].loaded = true;

    for(let image of this.images) {
      if(!image.loaded) {
        return;
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
