
import debounce from 'debounce';

import Logger from 'js-logger';

import {vec2, vec4} from 'gl-matrix';

import Loader, {Asset, STATE} from './loader.js';
import Shader from './shader.js';
import Mesh from './mesh.js';
import Texture from './texture.js';

import fallback_vert from './fallback.vert';
import fallback_frag from './fallback.frag';

// A WebGL 1 renderer.
export default class Renderer extends Asset {

  constructor(canvas, options) {
    super('@renderer');

    // Set up the asset loader to allow our state to change at will.
    this.can_move_backwards = true;
    
    this.canvas = canvas;

    this.options = options ? options : {};
    this.context = null;

    // The size of the canvas.
    this.size = [1, 1];

    // The DPI for this canvas.
    this.dpi = 1;

    // Call `flagDirty()` to force a render on the next frame.
    this._dirty = false;

    // Each key points to the currently active thing, or `null`.
    // This can be used to avoid re-activating an already-active GL object.
    this.active = {
      shader: null,
      buffer: null
    };

    this.performance = {
      vertex_count: 0,
      draw_call_count: 0,
      fps: 0,
      frametime_samples: 0,
      frametime_total: 0,
      frame_start: 0,

      current_frame: 0,
    };

    // Contains all the shaders we can use, keyed by their name.
    // A shader is not valid just because it is in this list; make sure
    // to check `shader.isReady()` first.
    this.shaders = {};
    
    // Contains all the meshes.
    this.meshes = {};

    // Contains all the textures.
    this.textures = new Loader('@texture-loader');

    // The scene to render.
    this.scene = null;

    this.initDebounce = debounce(this.init.bind(this), 150, true);
    this.resizeDebounce = debounce(this.resizeImmediate.bind(this), 50);

    // To avoid horrific error spam in the console. This should theoretically never happen.
    this.pause_rendering = false;

    this.handleLoaderStateChange = this.handleLoaderStateChange.bind(this);
  }

  init() {
    Logger.debug("Initializing WebGL renderer...");
    
    this.setState(STATE.LOADING);

    try {
      this.context = this.canvas.getContext('webgl', {
        alpha: false,
        ...this.options
      });
    } catch(e) {
      Logger.error("An error was thrown while creating WebGL 1 context!", e);
      throw new Error('webgl-context-create-error');
    }

    if(this.context === null) {
      Logger.error("WebGL context is null!");
      throw new Error('webgl-context-create-error');
    }

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.context = null;
      this.deinit();
      this.initDebounce();
    }, false);

    this.initShaders();
    this.initMeshes();
    this.initTextures();

    this.initCanvas();

    this.create();

    this.textures.on('statechange', this.handleLoaderStateChange);
    this.handleLoaderStateChange();

    // And kick off the first frame.
    requestAnimationFrame(this.render.bind(this));
  }

  handleLoaderStateChange() {
    this.setState(this.getCombinedState([
      this.textures
    ]));
  }

  create() {
    // Anybody inheriting `Renderer` should do all of their initialization here.
  }

  // Initialize default shaders.
  initShaders() {
    this.createShader('@fallback', fallback_vert, fallback_frag);
  }

  // Initialize default meshes.
  initMeshes() {
    let triangle = this.createMesh('@triangle');
    triangle.createMesh({
      aPosition: [
        [-0.5, -0.5, 0],
        [   0,  0.5, 0],
        [ 0.5, -0.5, 0],
      ]
    }, [
      [0, 1, 2]
    ]);
    
    let square = this.createMesh('@square');
    square.createMesh({
      aPosition: [
        [-0.5, -0.5, 0],
        [-0.5,  0.5, 0],
        [ 0.5,  0.5, 0],
        [ 0.5, -0.5, 0],
      ]
    }, [
      [0, 1, 2],
      [2, 0, 3]
    ]);
  }

  initTextures() {
    this.createTexture('@fallback').setFromColor(vec4.fromValues(1.0, 0.0, 1.0, 1.0));
    //fallback.setState(STATE.LOAD_COMPLETE);
  }

  initCanvas() {
    // Match our parent element's size.
    this.resizeImmediate();

    // Set up the clear color.
    let gl = this.context;
    gl.clearColor(0.0, 0.3, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  // Call this function when the canvas is ready to be destroyed.
  deinit() {
    Logger.debug(`Deinitializing renderer...`);

    for(let name of Object.keys(this.shaders)) {
      this.shaders[name].deinit();
    }

    this.shaders = {};
    
    for(let name of Object.keys(this.meshes)) {
      this.meshes[name].deinit();
    }

    this.meshes = {};
  }

  createShader(name, vertex_source, fragment_source) {
    if(name in this.shaders) {
      Logger.warn(`Duplicate shader '${name}' is being requested; deleting existing shader.`);
      this.shaders[name].deinit();
    }
    
    Logger.debug(`Creating shader '${name}'...`);
    
    let shader = new Shader(this, name, vertex_source, fragment_source);

    shader.init();

    this.shaders[name] = shader;

    return shader;
  }

  getShader(name) {
    if(name in this.shaders && this.shaders[name].isReady()) {
      return this.shaders[name];
    }

    return this.shaders['@fallback'];
  }

  createMesh(name) {
    if(name in this.meshes) {
      Logger.warn(`Duplicate mesh '${name}' is being requested; deleting existing mesh.`);
      this.meshes[name].deinit();
    }
    
    Logger.debug(`Creating mesh '${name}'...`);
    
    let mesh = new Mesh(this, name);

    this.meshes[name] = mesh;

    return mesh;
  }

  createTexture(name) {
    if(name in this.textures) {
      Logger.warn(`Duplicate texture '${name}' is being requested; deleting existing texture.`);
      this.textures[name].deinit();
    }
    
    Logger.debug(`Creating texture '${name}'...`);
    
    let texture = new Texture(this, name);
    texture.init();

    this.textures.addAsset(name, texture);

    return texture;
  }
  
  getTexture(name) {
    if(this.textures.hasAsset(name) && this.textures.getAsset(name).isReady()) {
      return this.textures.getAsset(name);
    }

    return this.textures.getAsset('@fallback');
  }

  // Automatically copies the size from the parent element of the canvas.
  resizeImmediate() {
    this.size = vec2.fromValues(this.canvas.parentElement.clientWidth, this.canvas.parentElement.clientHeight);
    this.dpi = window.devicePixelRatio;

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    this.canvas.width = this.size[0] * this.dpi;
    this.canvas.height = this.size[1] * this.dpi;

    this.flagDirty();
    
    Logger.debug(`Resizing renderer to ${this.size} @ ${this.dpi}x`);
  }

  resize() {
    this.resizeDebounce();
  }

  flagDirty() {
    this._dirty = true;
  }

  // The primary render function. This handles everything about rendering, from start to finish.
  render() {
    // If we've been deinitialized, bail out.
    if(this.context === null || this.pause_rendering) {
      return false;
    }

    requestAnimationFrame(this.render.bind(this));

    try {
      if(this.scene !== null) {
        this.scene.update(this);
      }
      
      // If we don't need to re-render, then don't.
      if(!this._dirty) {
        if(!(this.scene && this.scene._dirty)) {
          this.performance.frame_start = -1;
          return false;
        }
      }

      this._dirty = false;

      let gl = this.context;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.viewport(0, 0, this.size[0] * this.dpi, this.size[1] * this.dpi);

      this.performance.vertex_count = 0;
      this.performance.draw_call_count = 0;
      
      if(this.scene !== null) {
        this.scene.draw(this);
      } else {
        Logger.warn(`No scene to draw, skipping...`);
      }
      
      let end = Date.now() / 1000;

      if(this.performance.frame_start > 0) {
        this.performance.frametime_total += end - this.performance.frame_start;
        this.performance.frametime_samples += 1;
        
        if(this.performance.frametime_samples > 8) {
          this.performance.fps = this.performance.frametime_samples / this.performance.frametime_total;

          this.performance.frametime_total = 0;
          this.performance.frametime_samples = 0;
        }
      }

      this.performance.frame_start = end;
      
      this.performance.current_frame += 1;

      return true;
    } catch(e) {
      this.pause_rendering = true;
      throw e;
    }
  }

}

export {
  Shader
};
