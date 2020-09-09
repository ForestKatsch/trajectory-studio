
import React from 'react';
import AnimateHeight from 'react-animate-height';

import Logger from 'js-logger';

import OrreryRenderer from './renderer.js';

import EmptyState from '../../display/Empty.jsx';

import Switch from '../../interactive/Switch.jsx';
import CircularProgress from '../../progress/Circular.jsx';

import './style.css';

// A 3D viewer for stellar bodies and orbits.
class OrreryViewer extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {
      loaded: false,
      paused: false,
      
      use_anisotropy: true,
      display_stats: true,
      display_atmospheres: true,
      login: '',
      errorMessage: null,
      
      stats_fps: 0,
      stats_vertex_count: 0,
      stats_draw_call_count: 0,
      stats_frame_count: 0,
    };

    this.handleRendererStateChanged = this.handleRendererStateChanged.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    
    this.canvas = React.createRef();
    this.renderer = null;
  }

  componentDidMount() {
    this.renderer = new OrreryRenderer(this.canvas.current);

    this.initRenderer();

    window.addEventListener('resize', this.handleWindowResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize)

    this.deinitRenderer();
  }

  handleWindowResize() {
    this.renderer.resize();
  }

  handleRendererStateChanged(event) {
    if(!this.renderer.isLoaded()) {
      return;
    }

    this.setState((state, props) => ({
      loaded: true
    }));
  }

  initRenderer() {
    try {
      this.renderer.on('statechange', this.handleRendererStateChanged);
      this.renderer.init();
      this.renderer.viewer = this;
    } catch(e) {
      Logger.error('Error while creating WebGL context: ', e);
      
      this.setState((state, props) => ({
        errorMessage: `We couldn't initialize WebGL. It could be you; it could be us.'${e.message}'`
      }));

      return;
    }
  }

  deinitRenderer() {
    this.renderer.deinit();
  }

  createSwitchHandler(name) {
    return (checked) => {
      this.setState(state => ({
        [name]: checked
      }));
    };
  }

  render() {
    var emptyState = null;

    if(this.state.errorMessage) {
      emptyState = (
        <EmptyState variant="dark" title="Something went wrong" message={this.state.errorMessage}></EmptyState>
      );
    } else {
      emptyState = (
        <div className="OrreryViewer__loading">
          <CircularProgress size={64} />
        </div>
      );
    }

    if(this.renderer) {
      this.renderer.setOption('display_atmospheres', this.state.display_atmospheres);
      this.renderer.setOption('max_anisotropy_level', this.state.use_anisotropy ? 16 : 0);
      this.renderer.setOption('paused', this.state.paused);
    }
    
    return (
      <section className={`OrreryViewer ${this.state.loaded ? 'OrreryViewer--loaded' : ''}`}>
        <canvas ref={this.canvas}></canvas>
        {emptyState}
        <div className="OrreryViewer__options App--theme-light">
          <Switch
            label="Pause Renderer"
            checked={this.state.paused}
            onChange={this.createSwitchHandler('paused')}
          />
          <Switch
            label="Use Anisotropy"
            checked={this.state.use_anisotropy}
            onChange={this.createSwitchHandler('use_anisotropy')}
          />
          <Switch
            label="Planet Atmospheres"
            checked={this.state.display_atmospheres}
            onChange={this.createSwitchHandler('display_atmospheres')}
          />
          <Switch
            label="Show Stats"
            checked={this.state.display_stats}
            onChange={this.createSwitchHandler('display_stats')}
          />
          <AnimateHeight
            duration={150}
            height={this.state.display_stats ? 'auto' : 0}
          >
            <ul className={`stats`}>
              <li>{this.state.stats_fps.toFixed(1)} fps</li>
              <li>{this.state.stats_draw_call_count} draw calls</li>
              <li>{this.state.stats_vertex_count} vertices</li>
              <li>{this.state.stats_frame_count} frames</li>
            </ul>
            <CircularProgress step={this.state.stats_frame_count} />
          </AnimateHeight>
        </div>
      </section>
    );
  }
}

export default OrreryViewer;
