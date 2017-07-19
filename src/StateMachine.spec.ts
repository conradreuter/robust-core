import 'jest'
import CancellationToken from 'cancellationToken'
import Robust from './Robust'
import { Attempt, DEFAULT_WAIT_TIME, Down, Up, Wait, State, StateMachine } from './StateMachine'

jest.useFakeTimers()

describe('A robust state machine', () => {

  let options: Robust.Options
  let factory: jest.Mock<{}>
  let onUp: jest.Mock<{}>
  let onDown: jest.Mock<{}>
  let nextState: State<any>
  let sm: StateMachine<any>

  beforeEach(() => {
    options = {}
    factory = jest.fn()
    onUp = jest.fn()
    onDown = jest.fn()
    nextState = null
    sm = new StateMachine<any>(options, factory, onUp, onDown)
    sm.setState = function (state) {
      if (nextState) throw new Error('Multiple state transitions in one test')
      nextState = state
      nextState.up = jest.fn()
      nextState.down = jest.fn()
      setStateBypassingTheMock(nextState)
    }
  })

  afterEach(() => {
    jest.runAllTimers()
  })

  it('should be in the Down state by default', () => {
    expect(sm.state).toBeInstanceOf(Down)
  })

  describe('in the Down state', () => {

    const reason = {}

    beforeEach(() => {
      setStateBypassingTheMock(new Down<any>(sm, reason))
    })

    it('should change to the Wait state when up is called', () => {
      sm.state.up()
      expect(nextState).toBeInstanceOf(Wait)
      expect(nextState).toHaveProperty('reason', reason)
    })

    it('should call up on the new state when up is called', () => {
      sm.state.up()
      expect(nextState.up).toBeCalled()
    })

    it('should not change the state when down is called', () => {
      sm.state.down({})
      expect(nextState).toBeNull()
    })

    it('should not indicate that the resource is down when changing to the Wait state', () => {
      sm.setState(new Wait<any>(sm, reason))
      expect(onDown).not.toBeCalled()
    })
  })

  describe('in the Wait state', () => {

    const WAIT_TIME = 100
    const reason = {}

    beforeEach(() => {
      options.wait = () => WAIT_TIME
      setStateBypassingTheMock(new Wait<any>(sm, reason))
    })

    it('should change to the Attempt state and call up on it after the wait time has passed when up is called', () => {
      sm.state.up()
      jest.runTimersToTime(WAIT_TIME - 1)
      expect(nextState).toBeNull()
      jest.runTimersToTime(WAIT_TIME)
      expect(nextState).toBeInstanceOf(Attempt)
      expect(nextState).toHaveProperty('reason', reason)
      expect(nextState.up).toBeCalled()
    })

    it('should increment the number of attempts when up has been called', () => {
      sm.attempt = 42
      sm.state.up()
      expect(sm.attempt).toBe(43)
    })

    it('should change to the Down state when down is called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(nextState).toBeInstanceOf(Down)
      expect(nextState).toHaveProperty('reason', reason)
    })

    it('should go into the Down state when down is called after up before the wait time has elapsed', () => {
      sm.state.up()
      jest.runTimersToTime(WAIT_TIME - 1)
      sm.state.down({})
      jest.runTimersToTime(1)
      expect(nextState).toBeInstanceOf(Down)
    })

    it('should not set the state twice when up is called twice', () => {
      sm.state.up()
      sm.state.up()
      jest.runTimersToTime(WAIT_TIME) // should not throw
    })

    it('should not increase the wait time when up is called twice', () => {
      sm.state.up()
      jest.runTimersToTime(WAIT_TIME - 1)
      sm.state.up()
      jest.runTimersToTime(1)
      expect(nextState).not.toBeNull()
    })

    it('should not increment the number of attempts twice when up has been called twice', () => {
      sm.attempt = 42
      sm.state.up()
      sm.state.up()
      expect(sm.attempt).toBe(43)
    })

    it('should feed the number of failed attempts to the wait time calculation', () => {
      options.wait = jest.fn()
      sm.attempt = 42
      sm.state.up()
      expect(options.wait).toBeCalledWith(42)
    })

    it('should not indicate that the resource is down when changing to the Down state', () => {
      sm.setState(new Down<any>(sm, reason))
      expect(onDown).not.toBeCalled()
    })

    it('should not indicate that the resource is down when changing to the Attempt state', () => {
      sm.setState(new Attempt<any>(sm, reason))
      expect(onDown).not.toBeCalled()
    })

    it('should have a default wait time of zero for the first attempt', () => {
      options.wait = null
      sm.attempt = 0
      sm.state.up()
      expect(nextState).toBeNull()
      jest.runTimersToTime(0)
      expect(nextState).toBeInstanceOf(Attempt)
    })

    it('should have a default wait time of DEFAULT_WAIT_TIME for the subsequent attempts', () => {
      options.wait = null
      sm.attempt = 42
      sm.state.up()
      jest.runTimersToTime(DEFAULT_WAIT_TIME - 1)
      expect(nextState).toBeNull()
      jest.runTimersToTime(1)
      expect(nextState).toBeInstanceOf(Attempt)
    })
  })

  describe('in the Attempt state', () => {

    const reason = {}

    beforeEach(() => {
      setStateBypassingTheMock(new Attempt<any>(sm, reason))
    })

    it('should attempt to bring the resource up when up is called', () => {
      sm.state.up()
      jest.runTimersToTime(0)
      expect(factory).toBeCalled()
    })

    it('should change to the Up state when up has been called and the factory indicates that the resource is up', () => {
      const resource = {}
      const down = () => {}
      factory.mockImplementation((onUp, onDown, token) => onUp(resource, down))
      sm.state.up()
      jest.runTimersToTime(0)
      expect(nextState).toBeInstanceOf(Up)
      expect(nextState).toHaveProperty('resource', resource)
      expect(nextState).toHaveProperty('downImpl', down)
    })

    it('should pass a promise which indicates when the reasource is down when up has been called and the factory indicates that the resource is up', async () => {
      const reason = {}
      factory.mockImplementation((onUp, onDown, token) => (onUp({}, () => {}), onDown(reason)))
      sm.state.up()
      jest.runTimersToTime(0)
      expect((nextState as any).whenDown).resolves.toBe(reason)
    })

    it('should reset the number of attempts when up has been called and the factory indicates that the resource is up', () => {
      sm.attempt = 42
      factory.mockImplementation((onUp, onDown, token) => onUp({}, () => {}))
      sm.state.up()
      jest.runTimersToTime(0)
      expect(sm.attempt).toBe(0)
    })

    it('should change to the Wait state when up has been called and the factory throws an error', () => {
      const reason = {}
      factory.mockImplementation((inUp, onDown, token) => { throw reason })
      sm.state.up()
      jest.runTimersToTime(0)
      expect(nextState).toBeInstanceOf(Wait)
      expect(nextState).toHaveProperty('reason', reason)
    })

    it('should change to the Down state when down has been called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(nextState).toBeInstanceOf(Down)
      expect(nextState).toHaveProperty('reason', reason)
    })

    it('should not invoke the factory twice when up is called twice', () => {
      sm.state.up()
      sm.state.up()
      jest.runTimersToTime(0)
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('should cancel the factory when up has been called and then down has been called before the resource came up', () => {
      sm.state.up()
      sm.state.down({})
      jest.runTimersToTime(0)
      expect(factory).toBeCalled()
      expect(factory.mock.calls[0][2].isCancelled).toBe(true)
    })

    it('should not indicate that the resource is down when changing to the Down state', () => {
      sm.setState(new Down<any>(sm, reason))
      expect(onDown).not.toBeCalled()
    })

    it('should not indicate that the resource is down when changing to the Wait state', () => {
      sm.setState(new Wait<any>(sm, reason))
      expect(onDown).not.toBeCalled()
    })

    it('should indicate that the resource is up when changing to the Up state', () => {
      const resource = {}
      sm.setState(new Up<any>(sm, resource, () => {}, new Promise<void>(() => {})))
      expect(onUp).toBeCalled()
      expect(onUp.mock.calls[0][0]).toBe(resource)
    })
  })

  describe('in the Up state', () => {

    const resource = {}
    let down: jest.Mock<{}>
    let whenDown: Promise<any>
    let resolveWhenDown: (reason: any) => void

    beforeEach(() => {
      down = jest.fn()
      whenDown = new Promise<void>(resolve => resolveWhenDown = resolve)
      setStateBypassingTheMock(new Up<any>(sm, resource, down, whenDown))
    })

    it('should not change the state when up is called', () => {
      sm.state.up()
      expect(nextState).toBeNull()
    })

    it('should bring the resource down when down is called', () => {
      const reason = {}
      sm.state.down(reason)
      expect(down).toBeCalled()
      expect(down.mock.calls[0][0]).toBe(reason)
    })

    it('should change to the Down state when the down promise resolves', async () => {
      const reason = {}
      resolveWhenDown(reason)
      await whenDown
      expect(nextState).toBeInstanceOf(Down)
      expect(nextState).toHaveProperty('reason', reason)
    })

    it('should indicate that the resource is down when changing to the Down state', () => {
      const reason = {}
      sm.setState(new Down<any>(sm, reason))
      expect(onDown).toBeCalledWith(reason)
    })

    it('should indicate that the resource is down when changing to the Wait state', () => {
      const reason = {}
      sm.setState(new Wait<any>(sm, reason))
      expect(onDown).toBeCalled()
      expect(onDown.mock.calls[0][0]).toBe(reason)
    })
  })

  function setStateBypassingTheMock(state: State<any>) {
    StateMachine.prototype.setState.call(sm, state)
  }
})
