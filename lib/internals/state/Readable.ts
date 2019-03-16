import { Writable } from "stream";
import * as unorderedSet from "unordered-set";
import { Socket } from "../..";
import State from "./State";

namespace ReadableState {
  export interface Options extends State.Options {
    encoding?: string;
  }
}

class ReadableState extends State {
  public queued: Buffer | null = Buffer.alloc(0);

  public pipes: Array<Writable | Socket> = [];

  public reading = false;

  public ended = false;

  public flowing: boolean | null = null;

  public encoding?: string;

  constructor(options: ReadableState.Options = {}) {
    super(options);

    this.encoding = options.encoding;
  }

  // @ts-ignore
  public append(length: number) {
    return super.append(this.queued!, length);
  }

  // @ts-ignore
  public consume(bytes?: number) {
    const data = super.consume(bytes);
    const encoding = this.encoding;

    if (data === null || !encoding) return data;

    return data.toString(encoding);
  }

  public grow(size = this.highWaterMark - this.length) {
    return (this.queued = Buffer.allocUnsafe(size));
  }

  public addPipe(destination: Writable | Socket, socket: Socket) {
    unorderedSet.add(this.pipes, destination);

    destination.emit("pipe", socket);

    return this;
  }

  public removePipe(destination: Writable | Socket, socket: Socket) {
    unorderedSet.remove(this.pipes, destination);

    destination.emit("unpipe", socket);

    return this;
  }

  public pipe(size: number) {
    if (!size || !this.pipes.length) return this;

    const data = this.queued!.slice(0, size);
    const pipes = this.pipes;

    for (let i = pipes.length - 1; i >= 0; i--) pipes[i].write(data);

    return this;
  }
}

export default ReadableState;
