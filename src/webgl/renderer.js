
import debounce from 'debounce';

import Logger from 'js-logger';

import {vec2, vec4} from 'gl-matrix';

import Loader, {Asset, STATE} from './loader.js';
import Shader from './shader.js';
import Mesh from './mesh.js';
import Texture from './texture.js';

import {BLEND, DEPTH} from './material.js';

import fallback_vert from './fallback.vert';
import fallback_frag from './fallback.frag';

// A WebGL 1 renderer.
export default class Renderer extends Asset {

  constructor(canvas, options) {
    super('@renderer');

    // Set up the asset loader to allow our state to change at will.
    this.can_move_backwards = true;
    
    this.canvas = canvas;

    // Set to `true` to disable rendering except when resizing.
    this.paused = false;

    // This is set when the renderer needs to re-draw.
    this.draw_required = false;
    
    this.options = {
      max_anisotropy_level: 16,
      scale: 1,
      ...(options ? options : {})
    };
    
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
      buffer: null,
      blend_mode: null,
      depth_mode: null,
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

    // A key-value object containing the normalized extension name.
    this.extensions = {};

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
    this.terminate_rendering = false;

    this.handleLoaderStateChange = this.handleLoaderStateChange.bind(this);
    this.handleLoaderChildStateChange = this.handleLoaderChildStateChange.bind(this);
  }

  init() {
    Logger.debug("Initializing WebGL renderer...");
    
    this.setState(STATE.LOADING);

    const VALID_WEBGL_OPTIONS = [
      'alpha',
      'desynchronized',
      'antialias',
      'depth',
      'failIfMajorPerformanceCaveat',
      'powerPreference',
      'premultipliedAlpha',
      'preserveDrawingBuffer',
      'stencil'
    ];
    
    let webgl_options = {};

    for(let option_key of Object.keys(this.options)) {
      if(option_key in VALID_WEBGL_OPTIONS) {
        webgl_options[option_key] = this.options[option_key];
      }
    }

    try {
      this.context = this.canvas.getContext('webgl', {
        alpha: false,
        ...webgl_options
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

    this.initExtensions();

    this.initShaders();
    this.initMeshes();
    this.initTextures();

    this.initCanvas();

    this.create();

    this.textures.on('statechange', this.handleLoaderStateChange);
    this.textures.on('childstatechange', this.handleLoaderChildStateChange);
    this.handleLoaderStateChange();

    // And kick off the first frame.
    requestAnimationFrame(this.tick.bind(this));
  }

  handleLoaderStateChange() {
    this.setState(this.getCombinedState([
      this.textures
    ]));

    if(this.isLoaded()) {
      Logger.info(`All initial assets for this renderer are loaded.`);
    }
  }

  handleLoaderChildStateChange() {
    this.flagDirty();
  }

  create() {
    // Anybody inheriting `Renderer` should do all of their initialization here.
  }

  // Set an option on this renderer.
  setOption(name, value) {
    if(this.options[name] === value) {
      return;
    }
    
    this.options[name] = value;

    this.flagDirty();

    this.applyOptions();
  }

  applyOptions() {
    this.resize();
    this.applyTextureParameters();
  }

  applyTextureParameters() {
    for(let texture of Object.values(this.textures.getAllAssets())) {
      texture.applyParameters();
    }
  }

  initExtensions() {
    const gl = this.context;
    
    let aniso_ext = this.getExtension('EXT_texture_filter_anisotropic', 'MOZ_EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');

    if(aniso_ext) {
      aniso_ext.max = gl.getParameter(aniso_ext.ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    }
  }

  getExtension(name) {
    if(!(name in this.extensions)) {
      const gl = this.context;

      this.extensions[name] = null;
      
      for(let i=0; i<arguments.length; i++) {
        let extension = gl.getExtension(arguments[i]);

        if(extension !== null) {
          this.extensions[name] = {
            ext: extension
          };
          
          break;
        }
      }
    }
    
    return this.extensions[name];
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
    this.createTexture('@fallback').setFromColor(vec4.fromValues(0.0, 1.0, 1.0, 1.0));
    this.createTexture('@fallback-cube').setFromCheckerCubemap(vec4.fromValues(0.0, 1.0, 1.0, 1.0), vec4.fromValues(0.0, 0.0, 0.0, 1.0), 64, 8);
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

    Logger.warn(`No such shader '${name}'`);

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

  getMesh(name) {
    if(name in this.meshes && this.meshes[name].isReady()) {
      return this.meshes[name];
    }

    Logger.warn(`No such mesh '${name}'`);

    return this.meshes['@triangle'];
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
    if(this.textures.hasAsset(name)) {
      if(this.textures.getAsset(name).isReady()) {
        return this.textures.getAsset(name);
      }
    } else {
      //Logger.warn(`No such texture '${name}'`);
    }

    return this.textures.getAsset('@fallback');
  }

  // Automatically copies the size from the parent element of the canvas.
  resizeImmediate() {
    this.size = vec2.fromValues(this.canvas.parentElement.clientWidth, this.canvas.parentElement.clientHeight);
    this.dpi = window.devicePixelRatio;

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    vec2.scale(this.size, this.size, this.options.scale);

    this.canvas.width = this.size[0] * this.dpi;
    this.canvas.height = this.size[1] * this.dpi;

    this.flagDirty();
    this.draw_required = true;
    
    Logger.debug(`Resizing renderer to ${this.size} @ ${this.dpi}x`);
  }

  resize() {
    this.resizeDebounce();
  }

  flagDirty() {
    this._dirty = true;
  }

  setBlendMode(blend_mode) {
    const gl = this.context;

    if(this.active.blend_mode === blend_mode) {
      return;
    }

    this.active.blend_mode = blend_mode;
    
    switch(blend_mode) {
    case BLEND.OPAQUE:
      //Logger.debug('Switching to blend mode OPAQUE');
      gl.blendFunc(gl.ONE, gl.ZERO);
      break;
    case BLEND.ADD:
      //Logger.debug('Switching to blend mode ADD');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      break;
    default:
      Logger.warn(`Invalid blend mode '${blend_mode}'`);
    }
  }

  setDepthMode(depth_mode) {
    const gl = this.context;

    if(this.active.depth_mode === depth_mode) {
      return;
    }

    this.active.depth_mode = depth_mode;
    
    switch(depth_mode) {
    case DEPTH.IGNORE:
      //Logger.debug('Switching to depth mode IGNORE');
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      break;
    case DEPTH.READ_ONLY:
      //Logger.debug('Switching to depth mode READ_ONLY');
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      break;
    case DEPTH.READ_WRITE:
      //Logger.debug('Switching to depth mode READ_WRITE');
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      break;
    default:
      Logger.warn(`Invalid depth mode '${depth_mode}'`);
    }
  }

  // If we should draw this frame or not.
  shouldDraw() {
    // If we don't need to re-draw, then don't.
    if(!this._dirty && !this.draw_required) {
      if(!(this.scene && this.scene._dirty)) {
        this.performance.frame_start = -1;
        return false;
      }
    }

    if(this.paused && !this.draw_required) {
      return false;
    }

    // Only defer drawing when we're not loaded if we haven't drawn yet.
    if(!this.isLoaded() && this.performance.current_frame <= 1) {
      return false;
    }

    return true;
  }

  // The primary loop function. This handles everything about the draw loop, from start to finish.
  tick() {
    // If we've been deinitialized, bail out.
    if(this.context === null || this.terminate_drawing) {
      return false;
    }

    requestAnimationFrame(this.tick.bind(this));

    try {
      this.emit('tickbefore', {
        renderer: this
      });

      this.emit('updatebefore', {
        renderer: this
      });

      if(this.scene !== null) {
        this.scene.update(this);
      }

      this.emit('updateafter', {
        renderer: this
      });

      if(!this.shouldDraw()) {
        return false;
      }

      this._dirty = false;
      this.draw_required = false;

      // Set these values to zero so they only contain data for this frame.
      this.performance.vertex_count = 0;
      this.performance.draw_call_count = 0;

      this.emit('drawbefore', {
        renderer: this
      });

      // It does what it says.
      this.draw();

      this.emit('drawafter', {
        renderer: this
      });

      // Calculate performance.
      let end = Date.now() / 1000;

      // Only update if we've rendered at least one frame.
      if(this.performance.frame_start > 0) {
        this.performance.frametime_total += end - this.performance.frame_start;
        this.performance.frametime_samples += 1;

        // Every 8 frames, update the FPS and reset the stats for FPS.
        if(this.performance.frametime_samples > 8) {
          this.performance.fps = this.performance.frametime_samples / this.performance.frametime_total;

          this.performance.frametime_total = 0;
          this.performance.frametime_samples = 0;
        }
      }

      this.performance.frame_start = end;
      this.performance.current_frame += 1;

      this.emit('tickafter', {
        renderer: this
      });

      return true;
    } catch(err) {
      // There should be *zero* errors above. If there are, we terminate instantly.
      
      Logger.error(`Error occurred during render loop. Terminating render loop.`, err);
      Logger.trace(`Trace of above error`, err);
      
      this.terminate_drawing = true;
      
      this.emit('error', {
        error: err,
        renderer: this
      });

      throw err;
    }
  }

  draw() {
    const gl = this.context;
    
    //this.setBlendMode(BLEND.OPAQUE);
    //this.setDepthMode(DEPTH.READ_WRITE);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, this.size[0] * this.dpi, this.size[1] * this.dpi);

    if(this.scene !== null) {
      this.scene.draw(this);
    } else {
      Logger.warn(`No scene to draw, skipping...`);
    }
  }

}

export {
  Shader
};
