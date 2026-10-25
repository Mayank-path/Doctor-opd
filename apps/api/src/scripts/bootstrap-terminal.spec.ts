import { EventEmitter } from 'events';
import { TerminalManager } from './bootstrap-admin';

describe('TerminalManager', () => {
  let mockStdin: EventEmitter & {
    isTTY?: boolean;
    isRaw?: boolean;
    setRawMode?: jest.Mock;
  };

  beforeEach(() => {
    mockStdin = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      setRawMode: jest.fn((raw: boolean) => {
        mockStdin.isRaw = raw;
      }),
    });
  });

  it('should capture initial raw state and enable raw mode when setRaw is invoked', () => {
    const manager = new TerminalManager(
      mockStdin as unknown as NodeJS.ReadStream,
    );

    manager.setRaw();
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
  });

  it('should restore original terminal raw mode upon cleanup', () => {
    mockStdin.isRaw = false;
    const manager = new TerminalManager(
      mockStdin as unknown as NodeJS.ReadStream,
    );

    manager.setRaw();
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);

    manager.cleanup();
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
  });

  it('should be idempotent and not repeat cleanup if called multiple times', () => {
    const manager = new TerminalManager(
      mockStdin as unknown as NodeJS.ReadStream,
    );

    manager.setRaw();
    manager.cleanup();
    manager.cleanup();

    // setRawMode called once for setRaw(true) and once for cleanup(false)
    expect(mockStdin.setRawMode).toHaveBeenCalledTimes(2);
  });

  it('should remove data listener upon cleanup', () => {
    const manager = new TerminalManager(
      mockStdin as unknown as NodeJS.ReadStream,
    );
    const mockListener = jest.fn();

    manager.registerDataListener(mockListener);
    expect(mockStdin.listenerCount('data')).toBe(1);

    manager.cleanup();
    expect(mockStdin.listenerCount('data')).toBe(0);
  });

  it('should invoke onSigint and cleanup when SIGINT signal is fired', () => {
    const manager = new TerminalManager(
      mockStdin as unknown as NodeJS.ReadStream,
    );
    const onSigintMock = jest.fn();

    manager.registerSigint(onSigintMock);
    manager.setRaw();

    process.emit('SIGINT');

    expect(onSigintMock).toHaveBeenCalledTimes(1);
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
  });
});
