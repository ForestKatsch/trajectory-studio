
import Logger from 'js-logger';

export class Uniforms {
  
  constructor(dirty_function) {
    this.dirty_function = dirty_function;
    
    this.uniforms = {};
  }

  set(name, value) {
    if(name in this.uniforms) {
      if(this.uniforms[name] === value) {
        return;
      }
    }

    if(typeof value === typeof []) {
      this.uniforms[name] = [...value];
    } else {
      this.uniforms[name] = value;
    }
    
    this.dirty_function();
  }

  get() {
    return this.uniforms;
  }
}

// # `Shader`
// This is a shader. (Dear god.)
// It contains vertex and fragment shader sources.
//
// Lifecycle:
// ```
// <constructor>
// init() # This compiles the shaders and links the program. This function can throw errors.
// ... assuming init() was successful, the shader can now be used (with `use()`).
// deinit() # This deletes the shaders and programs. The shader is now invalid and cannot be used.
//
// ```
export default class Shader {

  constructor(renderer, name, vertex, fragment) {
    this.renderer = renderer;

    // The human-readable name of this shader.
    this.name = name;

    // The string sources for the vertex and fragment shaders.
    this.vertex_source = vertex;
    this.fragment_source = fragment;

    // The WebGL vertex and fragment shader objects.
    this.vertex = null;
    this.fragment = null;

    // The WebGL program.
    this.program = null;

    // Key-value object containing the attribute name as the key and the WebGL position index as the value.
    this.attributes = {};
    
    this.uniforms = {};
  }

  // Compiles a single shader stage and returns the result, or throws an error.
  compileShader(stage, source) {
    const gl = this.renderer.context;
    
    const shader = gl.createShader(stage);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      Logger.error(`Error while compiling WebGL shader '${this.name}'`, gl.getShaderInfoLog(shader), source);
      gl.deleteShader(shader);
      throw new Error('webgl-shader-compile');
    }

    return shader;        
  }

  // Initialize and compile this shader.
  init() {
    const gl = this.renderer.context;

    // Use our convenience function to compile the two shaders.
    this.vertex = this.compileShader(gl.VERTEX_SHADER, this.vertex_source);
    this.fragment = this.compileShader(gl.FRAGMENT_SHADER, this.fragment_source);

    this.program = gl.createProgram();
    
    gl.attachShader(this.program, this.vertex);
    gl.attachShader(this.program, this.fragment);
    
    gl.linkProgram(this.program);

    if(!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      Logger.error(`Error while linking WebGL shader '${this.name}'`, gl.getProgramInfoLog(this.program));
      this.program = null;
      throw new Error('webgl-shader-link');
    }
  }

  // Deinitialize this shader.
  deinit() {
    const gl = this.renderer.context;

    if(gl !== null) {
      gl.deleteShader(this.vertex);
      gl.deleteShader(this.fragment);
      
      gl.deleteProgram(this.program);
    }
    
    this.program = null;
  }

  // Sets this shader as active if necessary.
  use() {
    const gl = this.renderer.context;
    
    if(this.renderer.active.shader === this) {
      return;
    }

    this.renderer.active.shader = this;
    
    gl.useProgram(this.program);
  }

  isValid() {
    return this.program !== null;
  }
  
  // Given an attribute name, returns the location or throws an error if the attribute does not exist.
  getAttribute(name) {
    if(!(name in this.attributes)) {
      const gl = this.renderer.context;
      
      let location = gl.getAttribLocation(this.program, name);
      
      if(location === -1) {
        Logger.error(`Could not find attribute named '${name}' in shader '${this.name}'`);
        throw new Error('webgl-shader-invalid-attribute');
      }
      
      this.attributes[name] = location;
    }
    
    return this.attributes[name];
  }

  // Same as the above, but for uniforms.
  getUniform(name) {
    if(!(name in this.uniforms)) {
      const gl = this.renderer.context;
      
      const location = gl.getUniformLocation(this.program, name);
      
      if(location === -1) {
        Logger.error(`Could not find uniform named '${name}' in shader '${this.name}'`);
        throw new Error('webgl-shader-invalid-uniform');
      }
      
      this.uniforms[name] = location;
    }
    
    return this.uniforms[name];
  }

  setUniform(name, value, type) {
    const gl = this.renderer.context;
    const location = this.getUniform(name);
    
    if(type === undefined || type === 'auto') {

      if(typeof value === typeof 0) {
        if(value % 1 === value) {
          type = 'int';
        } else {
          type = 'float';
        }
      } else if(typeof value === typeof []) {
        if(value.length === 2) {
          type = 'fvec2';
        } else if(value.length === 3) {
          type = 'fvec3';
        } else if(value.length === 4) {
          type = 'fvec4';
        } else if(value.length === 9) {
          type = 'mat3';
        } else if(value.length === 16) {
          type = 'mat4';
        } else {
          Logger.warn(`Cannot auto-detect type of uniform '${name}' (on shader '${this.name}') array with ${value.length} elements, ignoring`, value);
          return;
        }
      } else {
        Logger.warn(`Cannot auto-detect type of uniform '${name}', ignoring`, value);
        return;
      }
    }

    // Don't debug this by default. (It just produces absolutely ridiculous amounts of spam.)
    if(false) {
      let value_string = '?';

      if(type.startsWith('fvec') || type.startsWith('ivec') || type.startsWith('vec')) {
        value_string = `(${value})`;
      } else if(type.startsWith('mat')) {
        // TODO: split this out into separate functions.
        if(type === 'mat3') {
          value_string = `
${value[0]}, ${value[3]}, ${value[6]},
${value[1]}, ${value[4]}, ${value[7]},
${value[2]}, ${value[5]}, ${value[8]},
`;
        } else if(type === 'mat4') {
          value_string = `
${value[0]}, ${value[4]}, ${value[8]}, ${value[12]},
${value[1]}, ${value[5]}, ${value[9]}, ${value[13]},
${value[2]}, ${value[6]}, ${value[10]}, ${value[14]},
${value[3]}, ${value[7]}, ${value[11]}, ${value[15]}`;
        }
      }
      
      Logger.debug(`Setting uniform '${name}' to:`, value_string);
    }

    switch(type) {
    case 'int':
      gl.uniform1i(location, value);
      break;
    case 'float':
      gl.uniform1f(location, value);
      break;
    case 'vec2':
    case 'fvec2':
      gl.uniform2fv(location, value);
      break;
    case 'vec3':
    case 'fvec3':
      gl.uniform3fv(location, value);
      break;
    case 'vec4':
    case 'fvec4':
      gl.uniform4fv(location, value);
      break;
    case 'mat3':
      gl.uniformMatrix3fv(location, false, value);
      break;
    case 'mat4':
      gl.uniformMatrix4fv(location, false, value);
      break;
    default:
      Logger.warn(`Cannot set uniform '${name}' with unknown type '${type}' ignoring`, value);
      break;
    }
  }

  // Expects a key-value listing of uniforms.
  // The uniform values should either be the value itself,
  // or an array of ["type", value].
  setUniforms(uniforms) {
    for(let name of Object.keys(uniforms)) {
      
      if(name.startsWith('@')) {
        continue;
      }
      
      if(typeof uniforms[name] === typeof [] && typeof uniforms[name][0] === typeof '') {
        this.setUniform(name, uniforms[name][1], uniforms[name][0]);
      } else {
        this.setUniform(name, uniforms[name]);
      }
    }
  }

}

