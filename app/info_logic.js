class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { info: false };
  }
  renderVals() {
    return { info: !!this.state.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }) };
  }
}
