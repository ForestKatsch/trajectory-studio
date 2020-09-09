
import Logger from 'js-logger';

const MAX_VERTICES_U16 = 65536;

export function flatten(array) {
  let flat = [];
  
  for(let i=0; i<array.length; i++) {
    if(typeof array[i] !== typeof 0) {
      flat.push.apply(flat, flatten(array[i]));
    } else {
      flat.push(array[i]);
    }
  }

  return flat;
}

// # `Buffer`
// A buffer is a low-level buffer that manages multiple attributes
// in one sequential array.
export class Buffer {

  constructor(mesh, name, type) {
    this.renderer = mesh.renderer;
    
    this.mesh = mesh;

    this.name = name;

    this.type = type;

    // The linear array of data for this buffer.
    this.data = [];

    // The WebGL buffer.
    this.buffer = null;

    this.attributes = {};
  }

  // Add a named attribute.
  addAttribute(name, options) {
    const gl = this.renderer.context;
    
    options = {
      // The offset, in bytes, to start at.
      offset: 0,
      
      // The number of components per vertex. This is analagous to the number in `vec3`, `vec2`, etc.
      size: 3,

      // The value type.
      type: gl.FLOAT,

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

    gl.bufferData(this.type, this.data, gl.STATIC_DRAW);
  }

  // Binds this buffer if necessary.
  bind() {
    const gl = this.renderer.context;
    
    if(this.renderer.active.buffer === this) {
      return;
    }

    this.renderer.active.buffer = this;

    gl.bindBuffer(this.type, this.buffer);
  }
  
  attachShader(shader) {
    this.bind();
    
    const gl = this.renderer.context;
    
    for(let name of Object.keys(this.attributes)) {
      let attrib = this.attributes[name];
      let attribute_location = shader.getAttributeLocation(name);

      if(attribute_location === -1) {
        continue;
      }
      
      gl.enableVertexAttribArray(attribute_location);
      gl.vertexAttribPointer(attribute_location,
                             attrib.size,
                             gl.FLOAT,
                             attrib.normalize,
                             attrib.stride,
                             attrib.offset);
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

    this.ready = false;

    this.vertex_count = 0;
  }

  createBuffer(name, type) {
    if(name in this.buffers) {
      Logger.warn(`Duplicate buffer '${name}' is being requested; deleting existing buffer.`);
      this.buffers[name].deinit();
    }

    let buffer = new Buffer(this, name, type);
    
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
    const gl = this.renderer.context;
    
    if(options === undefined) {
      options = {};
    }
    
    for(let layer_name of Object.keys(layers)) {
      let buffer = this.createBuffer(layer_name, gl.ARRAY_BUFFER);

      buffer.data = new Float32Array(flatten(layers[layer_name]));

      buffer.addAttribute(layer_name, {
        offset: 0,
        size: 3,
        type: gl.FLOAT,
        stride: 0,
      });
      
      this.buffers[layer_name] = buffer;
    }

    let buffer = this.createBuffer('@triangles', gl.ELEMENT_ARRAY_BUFFER);
    buffer.data = new Uint16Array(flatten(triangles));

    this.vertex_count = buffer.data.length;
    
    if(this.vertex_count > MAX_VERTICES_U16) {
      Logger.warn(`Mesh '${this.name}' has too many vertices (${this.vertex_count} > ${MAX_VERTICES_U16}). Expect unexpected issues.`);
    }
    
    buffer.addAttribute('@triangles', {
      offset: 0,
      size: 3,
      type: gl.UNSIGNED_INT,
      stride: 0,
    });
    
    this.buffers['@triangles'] = buffer;
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

  isReady() {
    return this.ready;
  }
  
  apply() {
    for(let buffer_name of Object.keys(this.buffers)) {
      this.buffers[buffer_name].apply();
    }
    
    this.ready = true;
  }

  draw(shader) {
    const gl = this.renderer.context;

    if(this.vertex_count < 2) {
      return;
    }

    for(let buffer_name of Object.keys(this.buffers)) {
      if(buffer_name.startsWith('@')) {
        continue;
      }
      
      this.buffers[buffer_name].attachShader(shader);
    }

    //gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

    this.buffers['@triangles'].bind();
    gl.drawElements(gl.TRIANGLES, this.vertex_count, gl.UNSIGNED_SHORT, 0);
    //gl.drawElements(gl.LINES, this.vertex_count, gl.UNSIGNED_SHORT, 0);
  }
}

