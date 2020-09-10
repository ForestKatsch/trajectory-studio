
import Logger from 'js-logger';

export const TYPE = {
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
  FVEC4: 0x8B52,

  IVEC2: 0x8B53,
  IVEC3: 0x8B54,
  IVEC4: 0x8B55,

  BVEC2: 0x8B57,
  BVEC3: 0x8B58,
  BVEC4: 0x8B59,

  MAT2: 0x8B5A,
  MAT3: 0x8B5B,
  MAT4: 0x8B5C,

  TEXTURE: 0x1702,
  TEXTURE_2D: 0x0DE1,
  TEXTURE_CUBE_MAP: 0x8513,

  SAMPLER_2D: 0x8B5E,
  SAMPLER_CUBE: 0x8B60,
};

export let TYPE_NAMES = {};

for(let key of Object.keys(TYPE)) {
  TYPE_NAMES[TYPE[key]] = key;
}

export let FROM_GL_TYPE = {};

for(let key of Object.keys(TYPE)) {
  FROM_GL_TYPE[TYPE[key]] = key;
}

FROM_GL_TYPE[TYPE.SAMPLER_2D] = TYPE.TEXTURE_2D;
FROM_GL_TYPE[TYPE.SAMPLER_CUBE] = TYPE.TEXTURE_CUBE_MAP;

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
      let attribute = gl.getActiveAttrib(this.program, i);

      let type = FROM_GL_TYPE[attribute.type];

      this.attributes[attribute.name] = {
        location: gl.getAttribLocation(this.program, attribute.name),
        name: attribute.name,
        type: type
      };
    }

    let uniform_count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for(let i=0; i<uniform_count; i++) {
      let uniform = gl.getActiveUniform(this.program, i);

      let type = FROM_GL_TYPE[uniform.type];

      this.uniforms[uniform.name] = {
        location: gl.getUniformLocation(this.program, uniform.name),
        name: uniform.name,
        type: type
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

      if(type >= TYPE.FVEC2 && type <= TYPE.BVEC4) {
        value_string = `(${value})`;
      } else if(type >= TYPE.MAT2 && type <= TYPE.MAT4) {
        // TODO: split this out into separate functions.
        if(type === TYPE.MAT3) {
          value_string = `
${value[0]}, ${value[3]}, ${value[6]},
${value[1]}, ${value[4]}, ${value[7]},
${value[2]}, ${value[5]}, ${value[8]},
`;
        } else if(type === TYPE.MAT4) {
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

  // Given a uniform name, a `Texture` (see `texture.js`, and a texture index, assigns
  // the uniform.
  setTextureUniform(uniform_name, texture, index) {
    const gl = this.renderer.context;
    const location = this.getUniformLocation(uniform_name);

    //Logger.debug(`Assigning '${texture.name}' as index ${index} for uniform '${uniform_name}'`);

    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(texture.type, texture.texture);
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

      if(type === TYPE.TEXTURE) {
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

  // Returns the requested texture, or a fallback texture. Returns null if the uniform is not a texture (sampler) type.
  resolveTexture(texture_name, expected_type) {
    let texture = null;

    //Logger.debug(`Resolving texture '${texture_name}'...`);

    if(texture_name) {
      texture = this.renderer.getTexture(texture_name);
    }

    if(texture && texture.type === expected_type && texture.isReady()) {
      return texture;
    }

    if(!texture.isReady()) {
      // NBD, just get a fallback texture. (Even if this texture is the wrong type, who cares? We're not using it anyway because it's not ready yet.)
    } else if(!texture.name.startsWith('@') && texture.type !== null) {
      Logger.warn(`Texture '${texture.name}' on shader '${this.name}' is wrong texture type (should be '${TYPE_NAMES[expected_type]}', found '${TYPE_NAMES[texture.type]}'), using fallback`);
    }

    let fallback = null;

    //Logger.debug(`Finding fallback for '${texture_name}'`);

    // Find the appropriate fallback texture name.
    if(texture.fallback) {
      fallback = texture.fallback;
    } else if(expected_type === TYPE.TEXTURE_2D) {
      fallback = '@fallback';
    } else if(expected_type === TYPE.TEXTURE_CUBE_MAP) {
      fallback = '@fallback-cube';
    } else {
      Logger.warn(`Unexpected texture type '${TYPE_NAMES[expected_type]}' for texture '${texture.name}' in shader '${this.name}', ignoring`);
      return null;
    }

    //Logger.debug(`Using '${fallback}' for '${texture_name}'`);

    return this.resolveTexture(fallback, expected_type);
  }

  // Sets every texture required from the uniforms here. Note that the format
  // for `uniform_values` is not the same as above.
  //
  // TODO: optimize this.
  setTextureUniforms(uniform_values) {
    let texture_index = 0;

    // We need to assign every uniform no matter what.
    for(let uniform_name of Object.keys(this.uniforms)) {
      let uniform_info = this.uniforms[uniform_name];

      // The expected type of this uniform, as read from the shader.
      let expected_uniform_type = uniform_info.type;

      // This isn't a texture uniform. Return null.
      if(expected_uniform_type !== TYPE.TEXTURE_2D &&
         expected_uniform_type !== TYPE.TEXTURE_CUBE_MAP) {
        continue;
      }

      let texture = this.resolveTexture(uniform_values[uniform_name].texture_name, expected_uniform_type);

      if(texture === null) {
        Logger.warn(`Resolved texture was null for uniform '${uniform_name}' on shader '${this.name}'`);
        continue;
      }

      this.setTextureUniform(uniform_name, texture, texture_index++);
    }
  }

}

