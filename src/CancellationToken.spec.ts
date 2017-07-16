import 'mocha'
import { expect } from 'chai'
import CancellationToken from './CancellationToken'

describe('A cancellation token', () => {

  context('that was created independently', () => {

    let cancel: () => void
    let token: CancellationToken

    beforeEach(() => {
      ;({ cancel, token } = CancellationToken.create())
    })

    it('should not be cancelled immediately after creation', () => {
      expect(token.isCancelled).to.be.false
    })

    it('should cancel correctly', () => {
      cancel()
      expect(token.isCancelled).to.be.true
    })

    it('should resolve its promise upon cancellation', () => {
      cancel()
      return token.whenCancelled
    })

    it('should throw a CancelledError when throwIfCancelled is called and the token is cancelled', () => {
      cancel()
      expect(() => token.throwIfCancelled()).to.throw(CancellationToken.Cancelled)
    })

    it('should not throw an error when throwIfCancelled is called and the token is not cancelled', () => {
      expect(() => token.throwIfCancelled()).to.not.throw
    })
  })

  context('that was created via all', () => {

    let cancel1: () => void
    let cancel2: () => void
    let token1: CancellationToken
    let token2: CancellationToken
    let token: CancellationToken

    beforeEach(() => {
      ;({ cancel: cancel1, token: token1 } = CancellationToken.create())
      ;({ cancel: cancel2, token: token2 } = CancellationToken.create())
      token = CancellationToken.all(token1, token2)
    })

    it('should be cancelled when all of the given tokens are cancelled', () => {
      cancel1()
      cancel2()
      expect(token.isCancelled).to.be.true
    })

    it('should not be cancelled when some of the given tokens are not cancelled', () => {
      cancel1()
      expect(token.isCancelled).to.be.false
    })

    it('should resolve its promise when all of the given tokens are cancelled', () => {
      cancel1()
      cancel2()
      return token.whenCancelled
    })

    it('should be cancelled immediately after creation if all of the given tokens are already cancelled', () => {
      cancel1()
      cancel2()
      expect(CancellationToken.all(token1, token2).isCancelled).to.be.true
    })
  })

  context('that was created via race', () => {

    let cancel1: () => void
    let cancel2: () => void
    let token1: CancellationToken
    let token2: CancellationToken
    let token: CancellationToken

    beforeEach(() => {
      ;({ cancel: cancel1, token: token1 } = CancellationToken.create())
      ;({ cancel: cancel2, token: token2 } = CancellationToken.create())
      token = CancellationToken.race(token1, token2)
    })

    it('should be cancelled when at least one of the given tokens is cancelled', () => {
      cancel1()
      expect(token.isCancelled).to.be.true
    })

    it('should not be cancelled when none of the given tokens are cancelled', () => {
      expect(token.isCancelled).to.be.false
    })

    it('should resolve its promise when at least one of the given tokens is cancelled', () => {
      cancel1()
      return token.whenCancelled
    })

    it('should be cancelled immediately after creation if one of the given tokens is already cancelled', () => {
      cancel1()
      expect(CancellationToken.race(token1, token2).isCancelled).to.be.true
    })
  })
})

describe('The CONTINUE cancellation token', () => {

  it('is not cancelled', () => {
    expect(CancellationToken.CONTINUE.isCancelled).to.be.false
  })
})

describe('The CANCEL cancellation token', () => {

  it('is cancelled', () => {
    expect(CancellationToken.CANCEL.isCancelled).to.be.true
  })
})
