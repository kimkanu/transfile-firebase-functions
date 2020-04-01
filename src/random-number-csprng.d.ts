declare module "random-number-csprng" {
  function randomInt(min: number, max: number): Promise<number>;
  export = randomInt;
}
