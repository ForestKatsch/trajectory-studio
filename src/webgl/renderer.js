
import Logger from 'js-logger';

import {vec2} from "gl-matrix";

export class Shader {

  constructor(renderer, vertex, fragment) {
    this.renderer = renderer;
    
    this.vertex_source = vertex;
    this.fragment_source = fragment;

    this.vertex = null;
    this.fragment = null;

    this.program = null;

    this.shader = null;
  }

  // Compiles a single shader stage and returns the result, or throws an error.
  compileShader(stage, source) {
    let gl = this.renderer.context;
    
    const shader = gl.createShader(stage);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      Logger.error('Error while compiling WebGL shader', gl.getShaderInfoLog(shader), source);
      gl.deleteShader(shader);
      throw new Error('webgl-shader-compile');
    }

    return shader;        
  }

  init() {
    let gl = this.renderer.context;

    // Use our convenience function to compile the two shaders.
    this.vertex = this.compileShader(gl.VERTEX_SHADER, this.vertex_source);
    this.fragment = this.compileShader(gl.FRAGMENT_SHADER, this.fragment_source);

    this.program = gl.createProgram();
    
    gl.attachShader(this.program, this.vertex);
    gl.attachShader(this.program, this.fragment);
    
    gl.linkProgram(this.program);

    if(!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      Logger.error('Error while linking WebGL shader', gl.getProgramInfoLog(this.program));
      throw new Error('webgl-shader-link');
    }
  }

  deinit() {
    let gl = this.renderer.context;

    gl.deleteShader(this.vertex);
    gl.deleteShader(this.fragment);
    
    gl.deleteProgram(this.program);
  }
  
}

// A WebGL 1 renderer.
export default class Renderer {

  constructor(canvas) {
    this.canvas = canvas;
    
    this.context = null;

    this.size = [1, 1];
    this.dpi = 1;

    this.dirty = false;

    this.shaders = {};
  }

  init() {
    Logger.debug("Initializing WebGL renderer...");
    
    try {
      this.context = this.canvas.getContext('webgl', {
        alpha: false
      });
    } catch(e) {
      Logger.error("An error was thrown while creating WebGL 1 context!", e);
      throw new Error('webgl-context-create-error');
    }

    if(this.context == null) {
      Logger.error("WebGL context is null!");
      throw new Error('webgl-context-create-error');
    }

    // Match our parent element's size.
    this.resize();

    // Set up the clear color.
    let gl = this.context;
    gl.clearColor(0.0, 0.3, 0.0, 1.0);

    this.initShaders();

    // And kick off the first frame.
    requestAnimationFrame(this.render.bind(this));
  }

  // Initialize default shaders.
  initShaders() {
    this.createShader('fallback', `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexNormal;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }`, `
    void main() {
      gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
    }`);
  }

  // Call this function when the canvas is ready to be destroyed.
  deinit() {
    Logger.debug(`Deinitializing renderer...`);

    for(let name of this.shaders) {
      this.shaders[name].deinit();
    }

    this.shaders = {};
  }

  createShader(name, vertex_source, fragment_source) {
    Logger.debug(`Creating shader '${name}'...`);
    let shader = new Shader(this, vertex_source, fragment_source);

    shader.init();

    this.shaders[name] = shader;
  }
  
  // Automatically copies the size from the parent element of the canvas.
  resize() {
    this.size = vec2.fromValues(this.canvas.parentElement.clientWidth, this.canvas.parentElement.clientHeight);
    this.dpi = window.devicePixelRatio;

    this.canvas.width = this.size[0];
    this.canvas.height = this.size[1];

    this.setDirty(true);
  }

  setDirty(dirty) {
    this.dirty = dirty;
  }

  // The primary render function. This handles everything about rendering, from start to finish.
  render() {
    if(this.context == null) {
      return;
    }

    requestAnimationFrame(this.render.bind(this));

    if(!this.dirty) {
      return;
    }

    this.dirty = false;

    let gl = this.context;
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

}
