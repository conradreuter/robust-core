import CancellationToken from './CancellationToken'
import Robust from './Robust'

const DEFAULT_WAIT = (attempt: number) => attempt ? 3000 : 0

/**
 * Manages the state of a {Robust<TResource>}.
 */
export class StateMachine<TResource> {

  private _state: State<TResource> = new Down<TResource>(this, undefined)

  /**
   * The number of attempts so far.
   */
  public attempt: number = 0

  /**
   * Creates a new {StateMachine<TResource>}.
   *
   * @param options The options of the robust resource.
   * @param factory The factory for creating the resource.
   * @param onUp Callback to indicate that the resource is up.
   * @param onDown Callback to indicate that the resource is down.
   */
  public constructor(
    public readonly options: Readonly<Robust.Options>,
    public readonly factory: Robust.Factory<TResource>,
    private readonly onUp: (resource: TResource) => void,
    private readonly onDown: (reason: any) => void,
  ) {
  }

  /**
   * The current state.
   */
  public get state(): State<TResource> {
    return this._state
  }

  /**
   * Sets the current state.
   *
   * @param newState The new state.
   */
  public setState(newState: State<TResource>): void {
    const oldState = this._state
    this._state = newState
    if ((oldState instanceof Down) && (newState instanceof Up)) {
      this.onUp(newState.resource)
    }
    if ((oldState instanceof Up) && (newState instanceof Down)) {
      this.onDown(newState.reason)
    }
  }
}

/**
 * The state of a {Robust<T>}.
 */
export interface State<TResource> {

  /**
   * Bring the resource up.
   */
  up(): void

  /**
   * Bring the resource down.
   *
   * @param reason The reason why the resource should come down.
   */
  down(reason: any): void
}

/**
 * Resource is down.
 */
export class Down<TResource> implements State<TResource> {

  public constructor(
    protected readonly sm: StateMachine<TResource>,
    public readonly reason: any,
  ) {
  }

  public up(): void {
    this.sm.setState(new Wait<TResource>(this.sm, this.reason))
    this.sm.state.up()
  }

  public down(reason: any): void {
  }
}

/**
 * Resource is down and currently waiting for the next attempt to bring it up.
 */
export class Wait<TResource> extends Down<TResource> {

  private timer: number | null = null

  public up(): void {
    if (this.timer !== null) return
    const time = (this.sm.options.wait || DEFAULT_WAIT)(this.sm.attempt)
    ++this.sm.attempt
    this.timer = setTimeout(() => {
      if (this.sm.state !== this) return
      this.sm.setState(new Attempt<TResource>(this.sm, this.reason))
      this.sm.state.up()
    }, time)
  }

  public down(reason: any): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.sm.setState(new Down<TResource>(this.sm, reason))
  }
}

/**
 * Resource is down and currently attempting to bring it up.
 */
export class Attempt<TResource> extends Down<TResource> {

  private cancel: () => void
  private hasBeenAttempted: boolean = false

  public up(): void {
    if (this.hasBeenAttempted) return
    this.hasBeenAttempted = true
    ++this.sm.attempt
    const { cancel, token } = CancellationToken.create()
    this.cancel = cancel
    const whenDown = new Promise<any>(resolve => setTimeout(() => {
      try {
        this.sm.factory(
          (resource, down) => {
            this.sm.attempt = 0
            this.sm.setState(new Up<TResource>(this.sm, resource, down, whenDown))
          },
          resolve,
          token,
        )
      } catch (reason) {
        this.sm.setState(new Wait<TResource>(this.sm, reason))
      }
    }, 0))
  }

  public down(reason: any): void {
    if (this.cancel) this.cancel()
    this.sm.setState(new Down<TResource>(this.sm, reason))
  }
}

/**
 * Resource is up.
 */
export class Up<TResource> implements State<TResource> {

  public constructor(
    private readonly sm: StateMachine<TResource>,
    public readonly resource: TResource,
    public readonly down: (reason: any) => void,
    public readonly whenDown: Promise<void>,
  ) {
    this.whenDown.then(reason => {
      if (this.sm.state !== this) return
      this.sm.setState(new Down<TResource>(this.sm, reason))
    })
  }

  public up(): void {
  }
}
