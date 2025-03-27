import { Component } from "./component";

export interface INewAble<T extends Component = Component> {
  new(...args: any[]): T
}