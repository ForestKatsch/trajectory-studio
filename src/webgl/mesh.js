
import Logger from 'js-logger';

// # `Buffer`
// A buffer is a low-level buffer that manages multiple attributes
// in one sequential array.
export class Buffer {

  constructor(mesh, name) {
    this.renderer = mesh.renderer;
    
    this.mesh = mesh;

    this.name = name;

    // The linear array of data for this buffer.
    this.data = [];

    // The WebGL buffer.
    this.buffer = null;

    this.attributes = {};
  }

  // Add a named attribute.
  addAttribute(name, options) {
    options = {
      // The offset, in bytes, to start at.
      offset: 0,
      
      // The number of components per vertex. This is analagous to the number in `vec3`, `vec2`, etc.
      size: 3,

      // The value type.
      type: 'float',

      // 
      normalized: false,
      
      // Bytes to skip between vertices.
      stride: 0,
      
      ...options
    };

    this.attributes[name] = options;
  }

  apply() {
    const gl = this.renderer.context;

    Logger.debug(`Creating buffer '${this.mesh.name}.${this.name}'...`);
    
    if(this.buffer === null) {
      this.buffer = gl.createBuffer();
    }

    this.bind();
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);
  }

  // Binds this buffer if necessary.
  bind(shader) {
    const gl = this.renderer.context;
    
    if(this.renderer.active.buffer === this) {
      return;
    }

    this.renderer.active.buffer = this;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  }
  
  attachShader(shader) {
    this.bind();
    
    const gl = this.renderer.context;
    
    for(let name of Object.keys(this.attributes)) {
      let attrib = this.attributes[name];
      gl.vertexAttribPointer(shader.getAttribute(name),
                             attrib.size,
                             gl.FLOAT,
                             attrib.normalize,
                             attrib.stride,
                             attrib.offset);
      gl.enableVertexAttribArray(shader.getAttribute(name));
    }

  }

  // Returns `true` if this buffer can be used in WebGL, `false` otherwise.
  isValid() {
    return this.buffer !== null;
  }

  deinit() {
    const gl = this.renderer.context;

    if(gl === null) {
      return;
    }
    
    gl.deleteBuffer(this.buffer);
  }

}

// # `Mesh`
// Contains multiple buffers, along with names.
//
// Lifecycle:
// ```
// <constructor>
// init() # This compiles the shaders and links the program. This function can throw errors.
// ... assuming init() was successful, the shader can now be used (with `use()`).
// deinit() # This deletes the shaders and programs. The shader is now invalid and cannot be used.
//
// ```
export default class Mesh {

  constructor(renderer, name) {
    this.renderer = renderer;

    this.name = name;

    // Buffers are keyed by their attribute name.
    this.buffers = {};
  }

  createBuffer(name) {
    if(name in this.buffers) {
      Logger.warn(`Duplicate buffer '${name}' is being requested; deleting existing buffer.`);
      this.buffers[name].deinit();
    }

    let buffer = new Buffer(this, name);
    
    this.buffers[name] = buffer;

    return buffer;
  }

  // A helper function to create the buffers for a mesh.
  // Layers is expected to be an object,
  // containing attribute-keyed data and lists of attributes.
  // ```
  // {
  //   "aPosition": [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
  //   "aNormal": [[0, 0, -1], [0, 0, -1], [0, 0, -1]]
  // }
  // ```
  //
  // **Triangles** contains a list of 3-item index lists.
  //
  // TODO: optimize this function to create one interleaved buffer instead.
  createMesh(layers, triangles, options) {
    if(options === undefined) {
      options = {};
    }
    
    for(let layer_name of Object.keys(layers)) {
      let buffer = this.createBuffer(layer_name);

      buffer.data = layers[layer_name].flat();

      buffer.addAttribute(layer_name, {
        offset: 0,
        size: 3,
        type: 'float',
        stride: 0,
      });
      
      this.buffers[layer_name] = buffer;
    }

    this.apply();
  }

  // Initializes stuff and creates all the buffers.
  init() {
    //this.apply();
  }

  deinit() {
    for(let buffer_name of Object.keys(this.buffers)) {
      this.buffers[buffer_name].deinit();
    }
  }

  apply() {
    for(let buffer_name of Object.keys(this.buffers)) {
      this.buffers[buffer_name].apply();
    }
  }

  draw(shader) {
    const gl = this.renderer.context;

    for(let buffer_name of Object.keys(this.buffers)) {
      this.buffers[buffer_name].attachShader(shader);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);
  }
}

