
import Logger from 'js-logger';

export class Renderable {

  constructor() {
    //
  }

  draw(renderer, spatial) {
    Logger.trace(`Drawing renderer for '${spatial.name}'`);
  }
  
}

export class MeshRenderable extends Renderable {

  constructor(mesh_name, material) {
    super();

    this.mesh_name = mesh_name;
    this.material = material;
    
    this._uniforms = {};
  }

  draw(renderer, spatial) {
    super.draw(renderer, spatial);

    const mesh = renderer.meshes[this.mesh_name];
    const shader = renderer.shaders[this.material.shader_name];

    if(mesh === null) {
      Logger.warn(`MeshRenderable for '${spatial.name}' points to non-existent mesh '${this.mesh_name}'`);
      return;
    }
    
    if(shader === null) {
      Logger.warn(`MeshRenderable for '${spatial.name}' points to non-existent shader '${this.shader_name}'`);
      return;
    }

    let uniforms = {
      ...this.material._uniforms,
      ...spatial._uniforms,
      ...this._uniforms,
    };

    shader.use();
    shader.setUniforms(uniforms);
    mesh.draw(shader);
  }
  
}

// # `Spatial`
//
// The `Spatial` class represents an object in 3D space, optionally with a mesh attached.
export default class Spatial {

  constructor(scene, name) {
    this.scene = scene;

    // Set to false to hide this spatial object and all its children.
    this.enabled = true;
    
    this.name = name;

    this.children = [];

    // A `Renderable` object that will be called to render this spatial object.
    this.renderable = null;

    this._uniforms = {};
  }

  draw(renderer) {
    if(!this.enabled) {
      return;
    }

    if(this.renderable !== null) {
      this.renderable.draw(renderer, this);
    }

    for(let child of this.children) {
      child.draw(renderer);
    }
  }

  // Adds a child.
  add(child) {
    this.children.push(child);
  }
}

