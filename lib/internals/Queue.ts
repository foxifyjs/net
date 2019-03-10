import Request from "./Request";

class Queue {
  public mask: number;

  public top = 0;

  public bottom = 0;

  public list: Request[];

  constructor(public size: number, public handle: number) {
    this.mask = size - 1;

    // tslint:disable-next-line:prefer-array-literal
    this.list = new Array(size);

    this.fill(0);
  }

  /**
   * In most cases this will never be called so use
   * a simple realloc method, to ensure it always works
   */
  public grow() {
    const size = this.size;
    // tslint:disable-next-line:prefer-array-literal
    const list = new Array(size * 2);

    for (let i = 0; i < size; i++) {
      list[i] = this.shift();
    }

    this.size = list.length;
    this.mask = this.size - 1;
    this.top = size;
    this.bottom = 0;
    this.list = list;

    this.fill(size);
  }

  public fill(offset: number) {
    for (let i = offset; i < this.list.length; i++) {
      this.list[i] = new Request(this.handle);
    }
  }

  public push() {
    const req = this.list[this.top];

    // tslint:disable-next-line:no-bitwise
    this.top = (this.top + 1) & this.mask;

    if (this.top === this.bottom) this.grow();

    return req;
  }

  public shift() {
    const req = this.list[this.bottom];

    // tslint:disable-next-line:no-bitwise
    this.bottom = (this.bottom + 1) & this.mask;

    return req;
  }

  public peek() {
    return this.list[this.bottom];
  }
}

export default Queue;
