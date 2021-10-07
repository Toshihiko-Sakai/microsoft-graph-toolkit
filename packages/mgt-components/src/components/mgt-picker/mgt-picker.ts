import { MgtTemplatedComponent, Providers, ProviderState } from '@microsoft/mgt-element';
import { customElement, property, query, state, html } from 'lit-element';
import { debounce } from '../../utils/Utils';
import { findPeople, getPeople } from '../../graph/graph.people';
import { IDynamicPerson } from '../../graph/types';
import { itemContentsTemplate } from './mgt-picker-fast-templates';
import { pickerDropDownMenuTemplate } from './mgt-picker-lit-templates';
import { Channel } from '@microsoft/microsoft-graph-types';
import { getChannels } from '../../graph/graph.teams-channels';
import { MgtPeoplePicker, MgtTeamsChannelPicker } from '../components';
import { styles } from './mgt-picker-css';

@customElement('mgt-picker')
export class MgtPicker extends MgtTemplatedComponent {
  /**
   * Array of styles to apply to the element. The styles should be defined
   * using the `css` tag function.
   */
  static get styles() {
    return styles;
  }
  // protected get strings() {
  //   return strings;
  // }
  private _debouncedSearch: { (): void; (): void };

  constructor() {
    super();
    this.clearState();
  }

  /**
   * array of entities to be used to search the graph
   *
   * @type {string[]}
   * @memberof MgtPicker
   */
  @property({
    attribute: 'entity-types',
    converter: value => {
      return value.split(',').map(v => v.trim());
    },
    type: String
  })
  public entityTypes: string[];

  /**
   * containing object of IDynamicPerson.
   * @type {IDynamicPerson[]}
   */
  @property({
    attribute: 'people',
    type: Object
  })
  public people: IDynamicPerson[] = [];

  /**
   * containing object of Channels.
   * @type {Channel[]}
   */
  @property({
    attribute: 'channels',
    type: Object
  })
  public channels: Channel[] = [];

  @query('fast-picker') private picker;

  @state() private defaultPeople: IDynamicPerson[];

  @state() private defaultChannels: Channel[];

  @state() private isLoading: boolean = true;

  @state() public hasPeople: boolean = false;
  @state() public hasChannels: boolean = false;

  createRenderRoot() {
    const root = document.createElement('div');
    this.appendChild(root);
    return root;
  }

  //"2804bc07-1e1f-4938-9085-ce6d756a32d2,e8a02cc7-df4d-4778-956d-784cc9506e5a,c8913c86-ceea-4d39-b1ea-f63a5b675166"
  public render() {
    return html`
      <fast-picker
        max-selected="1"
        no-suggestions-text="No suggestions available"
        suggestions-available-text="Suggestions available"
        loading-text="Loading"
        label="Select some things"
        filter-selected="false"
        filter-query="false"
        @querychange=${this.queryChanged}
        .showLoading=${this.isLoading}
        .listItemContentsTemplate=${itemContentsTemplate}>
      ${pickerDropDownMenuTemplate(this)}
    </fast-picker>
    `;
  }

  private queryChanged(e) {
    this.isLoading = true;

    this.requestStateUpdate();
  }

  /**
   * Async query to Graph for members of group if determined by developer.
   * set's `this.groupPeople` to those members.
   */
  protected async loadState(): Promise<void> {
    const provider = Providers.globalProvider;
    const entityHasChannels = this.entityTypes.includes('channels');
    const entityHasPeople = this.entityTypes.includes('people');
    const hasChannelScopes = await provider.getAccessTokenForScopes(...MgtTeamsChannelPicker.requiredScopes);
    const hasPeopleScopes = await provider.getAccessTokenForScopes(...MgtPeoplePicker.requiredScopes);

    if (provider && provider.state === ProviderState.SignedIn) {
      if (entityHasChannels && !hasChannelScopes) {
        return;
      }
      if (entityHasPeople && !hasPeopleScopes) {
        return;
      }

      const input = this.picker.query;
      const graph = provider.graph.forComponent(this);
      const hasDefaultPeople = this.defaultPeople.length > 0 && entityHasPeople;
      const hasDefaultChannels = this.defaultChannels.length > 0 && entityHasChannels;

      if (this.entityTypes.length > 0) {
        this.isLoading = true;
        if (entityHasPeople && !hasDefaultPeople) this.defaultPeople = await getPeople(graph);
        if (entityHasChannels && !hasDefaultChannels) {
          const dropDownItems = await getChannels(graph);
          this.defaultChannels = [];
          dropDownItems.forEach(item => {
            item.channels.forEach(channel => this.defaultChannels.push(channel.item as Channel));
          });
        }

        if (input) {
          if (!this._debouncedSearch) {
            // TODO(musale): Figure out how to debounce better
            this._debouncedSearch = debounce(async () => {
              const loadingTimeout = setTimeout(() => {
                this.isLoading = true;
              }, 50);
              if (entityHasPeople) {
                // TODO: report bug - workaround for picker not updating when input changes
                this.people = [];
                this.people = await findPeople(graph, input);
              }
              if (entityHasChannels) {
                this.channels = [];
                const dropDownItems = await getChannels(graph, input);
                dropDownItems.forEach(item => {
                  item.channels.forEach(channel => this.channels.push(channel.item as Channel));
                });
              }
              clearTimeout(loadingTimeout);
              this.isLoading = false;
            }, 300);
          }

          this._debouncedSearch();
        } else {
          this.people = this.defaultPeople;
          this.channels = this.defaultChannels;
        }
        if (this.people.length > 0) this.hasPeople = true;
        if (this.channels.length > 0) this.hasChannels = true;
      }
    }

    this.isLoading = false;
  }

  /**
   * Clears state of the component
   *
   * @protected
   * @memberof MgtPicker
   */
  protected clearState(): void {
    this.defaultChannels = [];
    this.defaultPeople = [];
    this.hasChannels = false;
    this.hasPeople = false;
  }
}
