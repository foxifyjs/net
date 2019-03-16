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
  public queued: Buffer = Buffer.allocUnsafe(this.highWaterMark);

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
  public consume(bytes?: number) {
    const data = super.consume(bytes);
    const encoding = this.encoding;

    if (data === null || !encoding) return data;

    return data.toString(encoding);
  }

  public queue(size = this.highWaterMark - this.length) {
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

  public pipe(data: Buffer) {
    if (!this.pipes.length) return this;

    const pipes = this.pipes;

    for (let i = pipes.length - 1; i >= 0; i--) pipes[i].write(data);

    return this;
  }
}

export default ReadableState;
