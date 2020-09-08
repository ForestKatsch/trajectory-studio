
import Logger from 'js-logger';

export const TYPE = {
  AUTO: 'AUTO',
  
  BOOL: 'BOOL',
  
  BYTE: 'BYTE',
  UNSIGNED_BYTE: 'UNSIGNED_BYTE',
  
  SHORT: 'SHORT',
  UNSIGNED_SHORT: 'UNSIGNED_SHORT',
  
  INT: 'INT',
  UNSIGNED_INT: 'UNSIGNED_INT',
  
  FLOAT: 'FLOAT',
  
  FVEC2: 'FVEC2',
  FVEC3: 'FVEC3',
  FVEC4: 'FVEC4',
  
  IVEC2: 'IVEC2',
  IVEC3: 'IVEC3',
  IVEC4: 'IVEC4',
  
  BVEC2: 'BVEC2',
  BVEC3: 'BVEC3',
  BVEC4: 'BVEC4',
  
  MAT2: 'MAT2',
  MAT3: 'MAT3',
  MAT4: 'MAT4',

  TEXTURE: 'TEXTURE',
  TEXTURE_2D: 'TEXTURE_2D',
  TEXTURE_CUBEMAP: 'TEXTURE_CUBEMAP',
};

export const GL_TYPE = {
  BOOL: 0x8B56,
  
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  
  FLOAT: 0x1406,
  
  FVEC2: 0x8B50,
  FVEC3: 0x8B51,
  FVEC4: 0X8B52,
  
  IVEC2: 0X8B53,
  IVEC3: 0X8B54,
  IVEC4: 0X8B55,
  
  BVEC2: 0X8B57,
  BVEC3: 0X8B58,
  BVEC4: 0X8B59,
  
  MAT2: 0X8B5A,
  MAT3: 0X8B5B,
  MAT4: 0X8B5C,
  
  TEXTURE: 0x1702,
  TEXTURE_2D: 0X8B5E,
  TEXTURE_CUBEMAP: 0X8B60
};

/* eslint-disable no-useless-computed-key */

export const FROM_GL_TYPE = {
  [0x8B56]: TYPE.BOOL,
  
  [0x1400]: TYPE.BYTE,
  [0x1401]: TYPE.UNSIGNED_BYTE,
  
  [0x1402]: TYPE.SHORT,
  [0x1403]: TYPE.UNSIGNED_SHORT,
  
  [0x1404]: TYPE.INT,
  [0x1405]: TYPE.UNSIGNED_INT,
  
  [0x1406]: TYPE.FLOAT,
  
  [0x8B50]: TYPE.FVEC2,
  [0x8B51]: TYPE.FVEC3,
  [0X8B52]: TYPE.FVEC4,
  
  [0X8B53]: TYPE.IVEC2,
  [0X8B54]: TYPE.IVEC3,
  [0X8B55]: TYPE.IVEC4,
  
  [0X8B57]: TYPE.BVEC2,
  [0X8B58]: TYPE.BVEC3,
  [0X8B59]: TYPE.BVEC4,
  
  [0X8B5A]: TYPE.MAT2,
  [0X8B5B]: TYPE.MAT3,
  [0X8B5C]: TYPE.MAT4,
  
  [0x1702]: TYPE.TEXTURE,
  [0X8B5E]: TYPE.TEXTURE_2D,
  [0X8B60]: TYPE.TEXTURE_CUBEMAP
};

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

      if(typeof this.uniforms[name] === typeof []) {
        if((this.uniforms[name].length === value.length) && 
           (this.uniforms[name].every((a, i) => { return a === value[i] }))) {
          return;
        }
      }
    }

    if(typeof value === typeof []) {
      this.uniforms[name] = [...value];
    } else {
      this.uniforms[name] = value;
    }

    //Logger.trace(`Uniform '${name}' is making this frame dirty`);
    
    this.dirty_function();
  }

  get() {
    return this.uniforms;
  }
}

export const BLEND = {
  OPAQUE: 0,
  ADD: 1
};

export const DEPTH = {
  IGNORE: 0,
  READ_ONLY: 1,
  NORMAL: 2
};

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

    this.blend_mode = BLEND.OPAQUE;

    this.depth_mode = DEPTH.NORMAL;
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

    this.fetchShaderParameters();
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

  fetchShaderParameters() {
    const gl = this.renderer.context;
    
    let attribute_count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    for(let i=0; i<attribute_count; i++) {
      var attribute = gl.getActiveAttrib(this.program, i);
      
      this.attributes[attribute.name] = {
        location: gl.getAttribLocation(this.program, attribute.name),
        name: attribute.name,
        type: FROM_GL_TYPE[attribute.type]
      };
    }
    
    let uniform_count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for(let i=0; i<uniform_count; i++) {
      let uniform = gl.getActiveUniform(this.program, i);
      
      this.uniforms[uniform.name] = {
        location: gl.getUniformLocation(this.program, uniform.name),
        name: uniform.name,
        type: FROM_GL_TYPE[uniform.type]
      };
    }
  }

  // Sets this shader as active if necessary.
  use() {
    const gl = this.renderer.context;
    
    if(this.renderer.active.shader === this) {
      return;
    }

    this.renderer.active.shader = this;
    
    gl.useProgram(this.program);

    if(this.blend_mode === BLEND.ADD) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ZERO);
    }

    switch(this.depth_mode) {
    case DEPTH.IGNORE:
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(gl.FALSE);
      break;
    case DEPTH.READ_ONLY:
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(gl.FALSE);
      break;
    default:
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(gl.TRUE);
      break;
    }
  }

  isReady() {
    return this.program !== null;
  }
  
  // Given an attribute name, returns the location or throws an error if the attribute does not exist.
  getAttributeLocation(name) {
    if(!(name in this.attributes)) {
      //Logger.error(`Could not find attribute named '${name}' in shader '${this.name}'`);
      return -1;
      //throw new Error('webgl-shader-invalid-attribute');
    }
    
    return this.attributes[name].location;
  }

  // Same as the above, but for uniforms.
  getUniformLocation(name) {
    if(!(name in this.uniforms)) {
      //Logger.error(`Could not find uniform named '${name}' in shader '${this.name}'`);
      return -1;
      //throw new Error('webgl-shader-invalid-uniform');
    }
    
    return this.uniforms[name].location;
  }

  // Given a name (for logging), a value, and an (optional) type,
  // returns the type (if given), the autodetected type (which isn't guaranteed to be correct!), or null.
  detectUniformType(name, value, type) {
    if(type !== undefined && type !== TYPE.AUTO) {
      return type;
    }

    if(typeof value === typeof 0) {
      if(value % 1 === value) {
        type = TYPE.INT;
      } else {
        type = TYPE.FLOAT;
      }
      // A texture.
    } else if(typeof value === typeof '') {
      type = TYPE.TEXTURE;
    } else if(typeof value === typeof []) {
      if(value.length === 2) {
        type = TYPE.FVEC2;
      } else if(value.length === 3) {
        type = TYPE.FVEC3;
      } else if(value.length === 4) {
        type = TYPE.FVEC4;
      } else if(value.length === 9) {
        type = TYPE.MAT3;
      } else if(value.length === 16) {
        type = TYPE.MAT4;
      } else {
        Logger.warn(`Cannot auto-detect type of uniform '${name}' (on shader '${this.name}') array with ${value.length} elements, ignoring`, value);
        return;
      }
    } else {
      Logger.warn(`Cannot auto-detect type of uniform '${name}', ignoring`, value);
      return null;
    }

    return type;
  }

  // Sets most uniform types. Does not set texture uniforms.
  setUniform(name, value, type) {
    const gl = this.renderer.context;
    const location = this.getUniformLocation(name);

    if(location < 0) {
      return;
    }
    
    // Don't log debug info by default. (It just produces absolutely ridiculous amounts of spam.)
    if(false) {
      let value_string = '?';

      if(type.startsWith('FVEC') || type.startsWith('IVEC') || type.startsWith('VEC')) {
        value_string = `(${value})`;
      } else if(type.startsWith('MAT')) {
        // TODO: split this out into separate functions.
        if(type === 'MAT3') {
          value_string = `
${value[0]}, ${value[3]}, ${value[6]},
${value[1]}, ${value[4]}, ${value[7]},
${value[2]}, ${value[5]}, ${value[8]},
`;
        } else if(type === 'MAT4') {
          value_string = `
${value[0]}, ${value[4]}, ${value[8]}, ${value[12]},
${value[1]}, ${value[5]}, ${value[9]}, ${value[13]},
${value[2]}, ${value[6]}, ${value[10]}, ${value[14]},
${value[3]}, ${value[7]}, ${value[11]}, ${value[15]}`;
        }
      }
      
      Logger.debug(`Setting uniform '${name}' of type '${type}' (${this.uniforms[name].type}) to`, value_string);
    }

    switch(type) {
    case TYPE.INT:
      gl.uniform1i(location, value);
      break;
    case TYPE.FLOAT:
      gl.uniform1f(location, value);
      break;
    case TYPE.FVEC2:
      gl.uniform2fv(location, value);
      break;
    case TYPE.FVEC3:
      gl.uniform3fv(location, value);
      break;
    case TYPE.FVEC4:
      gl.uniform4fv(location, value);
      break;
    case TYPE.MAT3:
      gl.uniformMatrix3fv(location, false, value);
      break;
    case TYPE.MAT4:
      gl.uniformMatrix4fv(location, false, value);
      break;
    case TYPE.TEXTURE:
      Logger.warn(`Cannot set texture uniform '${name}' in 'setUniform'. (See 'setTextureUniform.)`, value);
      break;
    default:
      Logger.warn(`Cannot set uniform '${name}' with unknown type '${type}' ignoring`, value);
      break;
    }
  }

  // Given a uniform name, a`Texture` (see `texture.js`, and a texture index, assigns
  // the uniform.
  setTextureUniform(uniform_name, texture, index) {
    const gl = this.renderer.context;
    const location = this.getUniformLocation(uniform_name);

    //Logger.debug(`Assigning '${texture.name}' as index ${index} for uniform '${uniform_name}'`);
    
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture.texture);
    gl.uniform1i(location, index);
  }
  
  // Expects a key-value listing of uniforms.
  // The uniform values should either be the value itself,
  // or an array of ["type", value].
  setUniforms(uniforms) {
    let textures = {};
    
    for(let name of Object.keys(uniforms)) {
      if(name.startsWith('@')) {
        continue;
      }

      let value = uniforms[name];
      let type = TYPE.AUTO;

      if(typeof uniforms[name] === typeof [] && typeof uniforms[name][0] === typeof '') {
        type = uniforms[name][0];
        value = uniforms[name][1];
      }

      type = this.detectUniformType(name, value, type);

      if(type.startsWith(TYPE.TEXTURE)) {
        textures[name] = {
          uniform_name: name,
          texture_name: value
        };
        continue;
      }
      
      this.setUniform(name, value, type);
    }

    this.setTextureUniforms(textures);
  }

  // Sets every texture required from the uniforms here. Note that the format
  // for `uniforms` is not the same as above.
  //
  // TODO: optimize this.
  setTextureUniforms(uniforms) {
    let texture_index = {
      [TYPE.TEXTURE_2D]: 0,
      [TYPE.TEXTURE_CUBEMAP]: 0,
    };

    // We need to assign every uniform no matter what.
    for(let uniform_name of Object.keys(this.uniforms)) {
      let uniform_info = this.uniforms[uniform_name];
      
      let expected_uniform_type = uniform_info.type;

      if(!expected_uniform_type.startsWith('TEXTURE')) {
        continue;
      }

      let texture = null;
      
      if(expected_uniform_type === TYPE.TEXTURE_2D) {
        texture = this.renderer.getTexture('@fallback');
      } else if(expected_uniform_type === TYPE.TEXTURE_CUBEMAP) {
        texture = this.renderer.getTexture('@fallback-cubemap');
      } else {
        Logger.warn(`Unexpected texture type '${expected_uniform_type}' for uniform '${uniform_name}' in shader '${this.name}', ignoring`);
        continue;
      }
      
      if(uniform_name in uniforms) {
        let uniform_texture = this.renderer.getTexture(uniforms[uniform_name].texture_name);
        
        if(uniform_texture.type === expected_uniform_type) {
          texture = uniform_texture;
        } else {
          Logger.warn(`Texture '${uniform_texture.name}' for uniform '${uniform_name}' on shader '${this.name}' is wrong texture type (should be '${expected_uniform_type}', found '${uniform_texture.type}'), using fallback`);
        }
      } else {
        //Logger.warn(`No texture given for '${uniform_name}' on shader '${this.name}', using fallback`);
      }
      
      this.setTextureUniform(uniform_name, texture, texture_index[texture.type]++);
    }
  }

}

