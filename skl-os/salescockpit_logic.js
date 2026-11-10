class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { view: 'results', info: false };
  }
  tab(active) {
    const base = 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; ';
    return active
      ? base + 'background: #1B1B18; color: #FFFFFF; font-weight: 600;'
      : base + 'background: transparent; color: #3D3A33; font-weight: 500;';
  }
  renderVals() {
    const v = this.state.view;
    const go = (x) => () => this.setState({ view: x });
    return {
      info: !!this.state.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      isResults: v === 'results', isExec: v !== 'results', view: v,
      tabResults: this.tab(v === 'results'), goResults: go('results'), onResults: v === 'results',
      tabExec: this.tab(v === 'execution'), goExec: go('execution'), onExec: v === 'execution',
      tabQual: this.tab(v === 'quality'), goQual: go('quality'), onQual: v === 'quality',
      tabImpact: this.tab(v === 'impact'), goImpact: go('impact'), onImpact: v === 'impact'
    };
  }
}
