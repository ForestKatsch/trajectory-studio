
import Renderer from '../../../webgl/renderer.js';
import Scene from '../../../webgl/scene.js';
import Material from '../../../webgl/material.js';
import Spatial, {MeshRenderable} from '../../../webgl/spatial.js';

export default class StellarRenderer extends Renderer {

  create() {
    super.create();

    this.scene = new Scene();

    this.material = new Material(this.scene, '@fallback');
    
    this.triangle = new Spatial(this.scene, 'triangle');
    this.triangle.renderable = new MeshRenderable('@triangle', this.material);

    this.scene.root.add(this.triangle);
  }

  render() {
    //this.material.set('uColor', [Math.sin(Date.now() / 100), 0, 0]);

    super.render();
  }
  
}
