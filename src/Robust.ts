import CancellationToken from './CancellationToken'

/**
 * Robust wrapper around a volatile resource.
 */
class Robust<TResource> {

  public constructor(
    private readonly options: Robust.Options,
    private readonly factory: Robust.Factory<TResource>,
  ) {
  }

  /**
   * Determines whether the resource is currently up.
   */
  public get isUp(): boolean {
    return NOT_IMPLEMENTED()
  }

  /**
   * Determines whether the resource is currently down.
   */
  public get isDown(): boolean {
    return !this.isUp
  }

  /**
   * Bring the resource up.
   *
   * @returns a promise that will resolve once the resource becomes up.
   */
  public up(): Promise<TResource> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Bring the resource down.
   *
   * @param reason An optional reason why the resource should come down.
   * @returns a promise that will resolve once the resource becomes down.
   */
  public down(reason?: any): Promise<void> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *once* when the resource comes up for the first time.
   *
   * The action will be immediately invoked if the resource is up at the time of calling.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel the invocation.
   * @returns the result of the action after its invocation.
   */
  public whenUp<T>(action: (resource: TResource) => T | Promise<T>, cancellationToken?: CancellationToken): Promise<T> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *whenever* the resource comes up.
   *
   * The action will be immediately invoked if the resource is up at the time of calling.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel all future invocations.
   * @returns the result of the action after its first invocation.
   */
  public wheneverUp<T>(action: (resource: TResource) => T | Promise<T>, cancellationToken?: CancellationToken): Promise<T> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *once* when the resource comes down for the first time.
   *
   * The action will be immediately invoked if the resource is down at the time of calling.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel the invocation.
   * @returns the result of the action after its invocation.
   */
  public whenDown<T>(action: (reason: any) => T | Promise<T>, cancellationToken?: CancellationToken): Promise<T> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *whenever* the resource comes down.
   *
   * The action will be immediately invoked if the resource is down at the time of calling.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel all future invocations.
   * @returns the result of the action after its first invocation.
   */
  public wheneverDown<T>(action: (reason: any) => T | Promise<T>, cancellationToken?: CancellationToken): Promise<T> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *once* when the resource changes its state for the first time.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel the invocation.
   * @returns the result of the action after its invocation.
   */
  public whenToggled<T>(action: (isUp: boolean) => T | Promise<T>, cancellationToken?: CancellationToken): Promise<T> {
    return NOT_IMPLEMENTED()
  }

  /**
   * Invoke the given action *whenever* the resource changes its state.
   *
   * @param action The action to be invoked.
   * @param cancellationToken An optional cancellation token to cancel all future invocations.
   * @returns the result of the action after its first invocation.
   */
  public wheneverToggled<T>(
    action: (isUp: boolean) => T | Promise<T>,
    cancellationToken: CancellationToken = CancellationToken.CONTINUE,
  ): Promise<T> {
    return NOT_IMPLEMENTED()
  }
}

function NOT_IMPLEMENTED(): never {
  throw new Error('not implemented ):')
}

namespace Robust {

  /**
   * Options for creating a {Robust<TResource>}.
   */
  export interface Options {

    /**
     * Calculates the time before attempting to bring the resource up.
     *
     * @param attempt The number of attempts that failed so far.
     * @returns the number of milliseconds to wait before the next attempt.
     */
    wait?: (attempt: number) => number
  }

  /**
   * Creates resources for a {Robust<TResource>}.
   */
  export interface Factory<TResource> {

    /**
     * Attempt to bring a resource up *once*.
     *
     * @param {upCallback} up Callback for indicating that the resource is up.
     * @param {downCallback} down Callback for indicating that the resource is down.
     * @param cancellationToken A cancellation token to cancel the up-bringing.
     * @returns the resource along with a method to bring it down, or an error if
     *    the resource could not be brought up.
     */
    (
      onUp: (resource: TResource, down: (reason: any) => void) => void,
      onDown: (reason: any) => void,
      cancellationToken: CancellationToken,
    ): void
  }
}

export default Robust
