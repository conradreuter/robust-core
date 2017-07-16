import 'mocha'
import { expect, use } from 'chai'
import * as SinonChai from 'sinon-chai'
import { match, sandbox as Sandbox } from 'sinon'
import CancellationToken from './CancellationToken'
import Robust from './Robust'
import { Attempt, Down, Up, Wait, State, StateMachine } from './StateMachine'
use(SinonChai)

describe('A robust state machine', () => {

  const sandbox = Sandbox.create({ useFakeTimers: true })
  const options: Robust.Options = {}
  const factoryStub = sandbox.stub()
  const onUpSpy = sandbox.spy()
  const onDownSpy = sandbox.spy()
  const sm: StateMachine<any> = new StateMachine<any>(options, factoryStub, onUpSpy, onDownSpy)
  const stateSpy = {
    isUp: false,
    up: sandbox.spy(),
    down: sandbox.spy(),
  }
  const setStateStub = sandbox.stub(sm, 'setState')

  after(() => sandbox.restore())

  beforeEach(() => {
    sandbox.reset()
    setStateStub.callsFake(() => setStateDirectly(stateSpy))
  })

  function setStateDirectly(state: State<any>) {
    (sm as any)._state = state
  }

  it('should be in the Down state by default', () => {
    expect(sm.state).to.be.an.instanceOf(Down)
  })

  context('in the Down state', () => {

    const reason = {}

    beforeEach(() => {
      setStateDirectly(new Down<any>(sm, reason))
    })

    it('should change to the Wait state when up is called', () => {
      sm.state.up()
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Wait)
        .and(match.has('reason', match.same(reason)))
      )
    })

    it('should call up on the new state when up is called', () => {
      sm.state.up()
      expect(stateSpy.up).to.have.been.called
    })

    it('should not change the state when down is called', () => {
      sm.state.down({})
      expect(sm.setState).to.not.have.been.called
      expect(sm.state).to.have.property('reason', reason)
    })

    it('should not indicate that the resource is down when changing to the Wait state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      sm.setState(new Wait<any>(sm, reason))
      expect(onDownSpy).to.not.have.been.called
    })
  })

  context('in the Wait state', () => {

    const WAIT = 100
    const reason = {}

    beforeEach(() => {
      options.wait = () => WAIT
      setStateDirectly(new Wait<any>(sm, reason))
    })

    it('should change to the Attempt state and call up on it after the wait time has passed when up is called', () => {
      sm.state.up()
      sandbox.clock.tick(WAIT)
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Attempt)
        .and(match.has('reason', match.same(reason))))
      expect(stateSpy.up).to.have.been.called
    })

    it('should increment the number of attempts when up has been called', () => {
      sm.attempt = 42
      sm.state.up()
      expect(sm.attempt).to.equal(43)
    })

    it('should not change to the Attempt state before the wait time has passed when up is called', () => {
      sm.state.up()
      sandbox.clock.tick(WAIT - 1)
      expect(sm.setState).to.not.have.been.called
    })

    it('should change to the Down state when down is called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Down)
        .and(match.has('reason', match.same(reason)))
      )
    })

    it('should go into the Down state when down is called after up before the wait time has elapsed', () => {
      sm.state.up()
      sandbox.clock.tick(WAIT - 1)
      sm.state.down({})
      sandbox.clock.tick(1)
      expect(sm.setState).to.not.have.been.calledWith(match.instanceOf(Attempt))
      expect(sm.setState).to.have.been.calledWith(match.instanceOf(Down))
    })

    it('should not set the state twice when up is called twice', () => {
      sm.state.up()
      sm.state.up()
      sandbox.clock.tick(WAIT)
      expect(sm.setState).to.have.been.calledOnce
    })

    it('should not increase the wait time when up is called twice', () => {
      sm.state.up()
      sandbox.clock.tick(WAIT - 1)
      sm.state.up()
      sandbox.clock.tick(1)
      expect(sm.setState).to.have.been.called
    })

    it('should not increment the number of attempts twice when up has been called twice', () => {
      sm.attempt = 42
      sm.state.up()
      sm.state.up()
      expect(sm.attempt).to.equal(43)
    })

    it('should feed the number of failed attempts to the wait time calculation', () => {
      options.wait = sandbox.spy()
      sm.attempt = 42
      sm.state.up()
      expect(options.wait).to.have.been.calledWith(42)
    })

    it('should not indicate that the resource is down when changing to the Down state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      sm.setState(new Down<any>(sm, reason))
      expect(onDownSpy).to.not.have.been.called
    })

    it('should not indicate that the resource is down when changing to the Attempt state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      sm.setState(new Attempt<any>(sm, reason))
      expect(onDownSpy).to.not.have.been.called
    })
  })

  context('in the Attempt state', () => {

    const reason = {}

    beforeEach(() => {
      setStateDirectly(new Attempt<any>(sm, reason))
    })

    it('should attempt to bring the resource up when up is called', () => {
      sm.state.up()
      sandbox.clock.tick(0)
      expect(factoryStub).to.have.been.called
    })

    it('should change to the Up state when up has been called and the factory indicates that the resource is up', () => {
      const resource = {}
      const down = () => {}
      factoryStub.callsArgWith(0, resource, down)
      sm.state.up()
      sandbox.clock.tick(0)
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Up)
        .and(match.has('resource', match.same(resource)))
        .and(match.has('down', match.same(down)))
        .and(match.has('whenDown', match.instanceOf(Promise)))
      )
    })

    it('should pass a promise which indicates when the reasource is down when up has been called and the factory indicates that the resource is up', async () => {
      const reason = {}
      factoryStub.callsFake((onUp, onDown) => {
        onUp({}, () => {})
        onDown(reason)
      })
      sm.state.up()
      sandbox.clock.tick(1)
      const nextState: Up<any> = await setStateStub.getCall(0).args[0]
      expect(await nextState.whenDown).to.equal(reason)
    })

    it('should reset the number of attempts when up has been called and the factory indicates that the resource is up', () => {
      sm.attempt = 42
      factoryStub.callsArgWith(0, {})
      sm.state.up()
      sandbox.clock.tick(0)
      expect(sm.attempt).to.equal(0)
    })

    it('should change to the Wait state when up has been called and the factory throws an error', () => {
      const reason = {}
      factoryStub.throws(reason)
      sm.state.up()
      sandbox.clock.tick(0)
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Wait)
        .and(match.has('reason', match.same(reason)))
      )
    })

    it('should change to the Down state when down has been called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Down)
        .and(match.has('reason', match.same(reason)))
      )
    })

    it('should not invoke the factory twice when up is called twice', () => {
      sm.state.up()
      sm.state.up()
      sandbox.clock.tick(0)
      expect(factoryStub).to.have.been.calledOnce
    })

    it('should cancel the factory when up has been called and then down has been called before the resource came up', () => {
      sm.state.up()
      sm.state.down({})
      sandbox.clock.tick(0)
      expect(factoryStub).to.have.been.calledWith(match.any, match.any, match.has('isCancelled', true))
    })

    it('should not indicate that the resource is down when changing to the Down state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      sm.setState(new Down<any>(sm, reason))
      expect(onDownSpy).to.not.have.been.called
    })

    it('should not indicate that the resource is down when changing to the Wait state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      sm.setState(new Wait<any>(sm, reason))
      expect(onDownSpy).to.not.have.been.called
    })

    it('should indicate that the resource is up when changing to the Up state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      const resource = {}
      sm.setState(new Up<any>(sm, resource, () => {}, new Promise<void>(() => {})))
      expect(onUpSpy).to.have.been.calledWith(resource)
    })
  })

  context('in the Up state', () => {

    const resource = {}
    const down = sandbox.spy()
    let whenDown: Promise<any>
    let resolveWhenDown: (reason: any) => void

    beforeEach(() => {
      whenDown = new Promise<void>(resolve => resolveWhenDown = resolve)
      setStateDirectly(new Up<any>(sm, resource, down, whenDown))
    })

    it('should not change the state when up is called', () => {
      sm.state.up()
      expect(sm.setState).to.not.have.been.called
      expect(sm.state).to.have.property('resource', resource)
      expect(sm.state).to.have.property('down', down)
      expect(sm.state).to.have.property('whenDown', whenDown)
    })

    it('should bring the resource down when down is called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(down).to.have.been.calledWith(match.same(reason))
    })

    it('should change to the Down state when the down promise resolves', async () => {
      const reason = {}
      resolveWhenDown(reason)
      await whenDown
      expect(sm.setState).to.have.been.calledWith(
        match.instanceOf(Down)
        .and(match.has('reason', match.same(reason)))
      )
    })

    it('should indicate that the resource is down when changing to the Down state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      const reason = {}
      sm.setState(new Down<any>(sm, reason))
      expect(onDownSpy).to.have.been.calledWith(reason)
    })

    it('should indicate that the resource is down when changing to the Wait state', () => {
      setStateStub.reset()
      setStateStub.callThrough()
      const reason = {}
      sm.setState(new Wait<any>(sm, reason))
      expect(onDownSpy).to.have.been.calledWith(reason)
    })
  })
})
