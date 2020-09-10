
import React from 'react';
import AnimateHeight from 'react-animate-height';

import Logger from 'js-logger';

import OrreryRenderer from './renderer.js';
import Navigation from './navigation.js';

import EmptyState from '../../components/display/Empty.jsx';

import Switch from '../../components/interactive/Switch.jsx';
import Select from '../../components/interactive/Select.jsx';
import CircularProgress from '../../components/progress/Circular.jsx';

import './style.css';

// A 3D viewer for stellar bodies and orbits.
class OrreryViewer extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {
      loaded: false,
      paused: false,

      loading: true,
      
      use_anisotropy: true,
      display_stats: true,
      display_atmospheres: true,
      login: '',
      errorMessage: null,
      
      stats_fps: 0,
      stats_vertex_count: 0,
      stats_draw_call_count: 0,
      stats_frame_count: 0,

      focus: 'earth',

      heading: 0,
      pitch: 0,
      distance: 9000 * 1000,
    };

    this.handleRendererUpdateBefore = this.handleRendererUpdateBefore.bind(this);
    this.handleRendererStateChanged = this.handleRendererStateChanged.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    
    this.canvas = React.createRef();
    this.renderer = null;
    this.navigation = null;
  }

  componentDidMount() {
    this.renderer = new OrreryRenderer(this.canvas.current);
    this.navigation = new Navigation(this.canvas.current);

    try {
      this.renderer.on('updatebefore', this.handleRendererUpdateBefore);
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

    window.addEventListener('resize', this.handleWindowResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize)
    this.renderer.off('updatebefore', this.handleRendererUpdateBefore);
    
    this.renderer.deinit();
    
    this.navigation.destroy();
  }

  handleWindowResize() {
    this.renderer.resize();
  }

  // Called before the renderer begins its update.
  handleRendererUpdateBefore(event) {
    let values = this.navigation.getValues();

    this.navigation.resetValues();

    // Zoom
    let zoom_factor = 0.002;

    let body_radius = this.renderer.getFocusBody().scale[0] / 2;

    let distance = this.state.distance + values.zoom * zoom_factor * (this.renderer.camera.position[2] - body_radius);
    
    let angle_factor = 0.3;
    angle_factor *= Math.min((this.state.distance - body_radius) / (body_radius * 2), 1.0);
    
    this.setState((state, props) => ({
      heading: state.heading + values.heading * angle_factor,
      pitch: Math.min(Math.max(state.pitch + values.pitch * angle_factor, -90), 90),
      distance: Math.max(distance, 10),
    }));
  }

  handleRendererStateChanged(event) {
    if(!this.renderer.isLoaded()) {
      return;
    }

    this.setState((state, props) => ({
      loaded: true
    }));
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

      this.renderer.input = {
        ...this.renderer.input,

        focus: this.state.focus,
        
        heading: this.state.heading,
        pitch: this.state.pitch,
        distance: this.state.distance,
      };
    }
    
    return (
      <section className={`OrreryViewer ${this.state.loaded ? 'OrreryViewer--loaded' : ''}`}>
        <canvas ref={this.canvas}></canvas>
        {emptyState}
        <div className="OrreryViewer__info">
          <CircularProgress visible={this.state.loading} size={24} />
        </div>
        {/*
        <div className="OrreryViewer__view">
          <Select label="Focus" fill>
            <div>ugh</div>
          </Select>
          <Select label="Orientation" fill></Select>
        </div>
         */}
        <div className="OrreryViewer__options App--theme-light">
          {/*
          <Switch
            label="Pause Renderer"
            checked={this.state.paused}
            onChange={this.createSwitchHandler('paused')}
            />
          <Switch
            label="Use Anisotropy"
            checked={this.state.use_anisotropy}
            onChange={this.createSwitchHandler('use_anisotropy')}
          />*/}
          <Switch
            label="Focus on Sun"
            checked={this.state.focus === 'sun'}
            onChange={() => {this.state.focus === 'sun' ? this.setState({focus: 'earth'}) : this.setState({focus: 'sun'})}}
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
            {this.renderer !== null ? (
            <ul className={`stats`}>
              <li>{(this.renderer.camera.position[2] / 1000 - 6371).toFixed(1)} km altitude</li>
              <li>{this.state.stats_fps.toFixed(1)} fps</li>
              <li>{this.state.stats_draw_call_count} draw calls</li>
              <li>{this.state.stats_vertex_count} vertices</li>
              <li>{this.state.stats_frame_count} frames</li>
              <li className="OrreryViewer__progress">
                <span>Render</span>
                <CircularProgress step={this.state.stats_frame_count + 1} />
              </li>
            </ul>
            ) : null }
            <span></span>
          </AnimateHeight>
        </div>
      </section>
    );
  }
}

export default OrreryViewer;
