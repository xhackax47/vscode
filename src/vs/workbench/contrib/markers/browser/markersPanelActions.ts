/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Delayer } from 'vs/base/common/async';
import * as DOM from 'vs/base/browser/dom';
import { Action, IActionChangeEvent, IAction, IActionRunner } from 'vs/base/common/actions';
import { HistoryInputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IContextViewService, IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import Messages from 'vs/workbench/contrib/markers/browser/messages';
import Constants from 'vs/workbench/contrib/markers/browser/constants';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { IThemeService, registerThemingParticipant, ICssStyleCollector, ITheme } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler, attachStylerCallback } from 'vs/platform/theme/common/styler';
import { toDisposable } from 'vs/base/common/lifecycle';
import { BaseActionViewItem, ActionViewItem, ActionBar, Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { badgeBackground, badgeForeground, contrastBorder, inputActiveOptionBorder, inputActiveOptionBackground } from 'vs/platform/theme/common/colorRegistry';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ContextScopedHistoryInputBox } from 'vs/platform/browser/contextScopedHistoryWidget';
import { Marker } from 'vs/workbench/contrib/markers/browser/markersModel';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Event, Emitter } from 'vs/base/common/event';
import { FilterOptions } from 'vs/workbench/contrib/markers/browser/markersFilterOptions';
import { DropdownMenuActionViewItem } from 'vs/base/browser/ui/dropdown/dropdown';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';

export class ToggleMarkersPanelAction extends TogglePanelAction {

	public static readonly ID = 'workbench.actions.view.problems';
	public static readonly LABEL = Messages.MARKERS_PANEL_TOGGLE_LABEL;

	constructor(id: string, label: string,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IPanelService panelService: IPanelService
	) {
		super(id, label, Constants.MARKERS_PANEL_ID, panelService, layoutService);
	}
}

export class ShowProblemsPanelAction extends Action {

	public static readonly ID = 'workbench.action.problems.focus';
	public static readonly LABEL = Messages.MARKERS_PANEL_SHOW_LABEL;

	constructor(id: string, label: string,
		@IPanelService private readonly panelService: IPanelService
	) {
		super(id, label);
	}

	public run(): Promise<any> {
		this.panelService.openPanel(Constants.MARKERS_PANEL_ID, true);
		return Promise.resolve();
	}
}

export interface IMarkersFilterActionChangeEvent extends IActionChangeEvent {
	filterText?: boolean;
	excludedFiles?: boolean;
	showWarnings?: boolean;
	showErrors?: boolean;
	showInfos?: boolean;
	activeFile?: boolean;
}

export interface IMarkersFilterActionOptions {
	filterText: string;
	filterHistory: string[];
	showErrors: boolean;
	showWarnings: boolean;
	showInfos: boolean;
	excludedFiles: boolean;
	activeFile: boolean;
}

export class MarkersFilterAction extends Action {

	public static readonly ID: string = 'workbench.actions.problems.filter';

	private readonly _onFocus: Emitter<void> = this._register(new Emitter<void>());
	readonly onFocus: Event<void> = this._onFocus.event;

	constructor(options: IMarkersFilterActionOptions) {
		super(MarkersFilterAction.ID, Messages.MARKERS_PANEL_ACTION_TOOLTIP_FILTER, 'markers-panel-action-filter', true);
		this._filterText = options.filterText;
		this._showErrors = options.showErrors;
		this._showWarnings = options.showWarnings;
		this._showInfos = options.showInfos;
		this._excludedFiles = options.excludedFiles;
		this._activeFile = options.activeFile;
		this.filterHistory = options.filterHistory;
	}

	private _filterText: string;
	get filterText(): string {
		return this._filterText;
	}
	set filterText(filterText: string) {
		if (this._filterText !== filterText) {
			this._filterText = filterText;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ filterText: true });
		}
	}

	filterHistory: string[];

	private _excludedFiles: boolean;
	get excludedFiles(): boolean {
		return this._excludedFiles;
	}
	set excludedFiles(filesExclude: boolean) {
		if (this._excludedFiles !== filesExclude) {
			this._excludedFiles = filesExclude;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ excludedFiles: true });
		}
	}

	private _activeFile: boolean;
	get activeFile(): boolean {
		return this._activeFile;
	}
	set activeFile(activeFile: boolean) {
		if (this._activeFile !== activeFile) {
			this._activeFile = activeFile;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ activeFile: true });
		}
	}

	private _showWarnings: boolean = true;
	get showWarnings(): boolean {
		return this._showWarnings;
	}
	set showWarnings(showWarnings: boolean) {
		if (this._showWarnings !== showWarnings) {
			this._showWarnings = showWarnings;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ showWarnings: true });
		}
	}

	private _showErrors: boolean = true;
	get showErrors(): boolean {
		return this._showErrors;
	}
	set showErrors(showErrors: boolean) {
		if (this._showErrors !== showErrors) {
			this._showErrors = showErrors;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ showErrors: true });
		}
	}

	private _showInfos: boolean = true;
	get showInfos(): boolean {
		return this._showInfos;
	}
	set showInfos(showInfos: boolean) {
		if (this._showInfos !== showInfos) {
			this._showInfos = showInfos;
			this._onDidChange.fire(<IMarkersFilterActionChangeEvent>{ showInfos: true });
		}
	}

	focus(): void {
		this._onFocus.fire();
	}

	layout(width: number): void {
		if (width > 600) {
			this.class = 'markers-panel-action-filter grow';
		} else if (width < 400) {
			this.class = 'markers-panel-action-filter small';
		} else {
			this.class = 'markers-panel-action-filter';
		}
	}
}

export interface IMarkerFilterController {
	onDidFilter: Event<void>;
	getFilterOptions(): FilterOptions;
	getFilterStats(): { total: number, filtered: number };
}

class FiltersDropdownMenuActionViewItem extends DropdownMenuActionViewItem {

	constructor(
		action: IAction, private filterAction: MarkersFilterAction, actionRunner: IActionRunner,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		super(action,
			{ getActions: () => this.getActions() },
			contextMenuService,
			action => undefined,
			actionRunner!,
			undefined,
			action.class,
			() => { return AnchorAlignment.RIGHT; });
	}

	render(container: HTMLElement): void {
		super.render(container);
		this.updateChecked();
	}

	private getActions(): IAction[] {
		return [
			{
				checked: this.filterAction.showErrors,
				class: undefined,
				enabled: true,
				id: 'showErrors',
				label: Messages.MARKERS_PANEL_FILTER_LABEL_SHOW_ERRORS,
				run: async () => this.filterAction.showErrors = !this.filterAction.showErrors,
				tooltip: '',
				dispose: () => null
			},
			{
				checked: this.filterAction.showWarnings,
				class: undefined,
				enabled: true,
				id: 'showWarnings',
				label: Messages.MARKERS_PANEL_FILTER_LABEL_SHOW_WARNINGS,
				run: async () => this.filterAction.showWarnings = !this.filterAction.showWarnings,
				tooltip: '',
				dispose: () => null
			},
			{
				checked: this.filterAction.showInfos,
				class: undefined,
				enabled: true,
				id: 'showInfos',
				label: Messages.MARKERS_PANEL_FILTER_LABEL_SHOW_INFOS,
				run: async () => this.filterAction.showInfos = !this.filterAction.showInfos,
				tooltip: '',
				dispose: () => null
			},
			new Separator(),
			{
				checked: this.filterAction.activeFile,
				class: undefined,
				enabled: true,
				id: 'activeFile',
				label: Messages.MARKERS_PANEL_FILTER_LABEL_ACTIVE_FILE,
				run: async () => this.filterAction.activeFile = !this.filterAction.activeFile,
				tooltip: '',
				dispose: () => null
			},
			{
				checked: this.filterAction.excludedFiles,
				class: undefined,
				enabled: true,
				id: 'useFilesExclude',
				label: Messages.MARKERS_PANEL_FILTER_LABEL_EXCLUDED_FILES,
				run: async () => this.filterAction.excludedFiles = !this.filterAction.excludedFiles,
				tooltip: '',
				dispose: () => null
			},
		];
	}

	updateChecked(): void {
		DOM.toggleClass(this.element!, 'checked', this._action.checked);
	}

}

export class MarkersFilterActionViewItem extends BaseActionViewItem {

	private delayedFilterUpdate: Delayer<void>;
	private container: HTMLElement | null = null;
	private filterInputBox: HistoryInputBox | null = null;
	private filterBadge: HTMLElement | null = null;
	private focusContextKey: IContextKey<boolean>;
	private readonly filtersAction: IAction;

	constructor(
		readonly action: MarkersFilterAction,
		private filterController: IMarkerFilterController,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(null, action);
		this.focusContextKey = Constants.MarkerPanelFilterFocusContextKey.bindTo(contextKeyService);
		this.delayedFilterUpdate = new Delayer<void>(200);
		this._register(toDisposable(() => this.delayedFilterUpdate.cancel()));
		this._register(action.onFocus(() => this.focus()));
		this.filtersAction = new Action('markersFiltersAction', Messages.MARKERS_PANEL_ACTION_TOOLTIP_MORE_FILTERS, 'markers-filters codicon-filter');
		this.filtersAction.checked = this.hasFiltersChanged();
		this._register(action.onDidChange(() => this.filtersAction.checked = this.hasFiltersChanged()));
	}

	render(container: HTMLElement): void {
		this.container = container;
		DOM.addClass(this.container, 'markers-panel-action-filter-container');

		this.element = DOM.append(this.container, DOM.$(''));
		this.element.className = this.action.class || '';
		this.createInput(this.element);
		this.createControls(this.element);

		this.adjustInputBox();
	}

	focus(): void {
		if (this.filterInputBox) {
			this.filterInputBox.focus();
		}
	}

	private hasFiltersChanged(): boolean {
		return !this.action.showErrors || !this.action.showWarnings || !this.action.showInfos || this.action.excludedFiles || this.action.activeFile;
	}

	private createInput(container: HTMLElement): void {
		this.filterInputBox = this._register(this.instantiationService.createInstance(ContextScopedHistoryInputBox, container, this.contextViewService, {
			placeholder: Messages.MARKERS_PANEL_FILTER_PLACEHOLDER,
			ariaLabel: Messages.MARKERS_PANEL_FILTER_ARIA_LABEL,
			history: this.action.filterHistory
		}));
		this.filterInputBox.inputElement.setAttribute('aria-labelledby', 'markers-panel-arialabel');
		this._register(attachInputBoxStyler(this.filterInputBox, this.themeService));
		this.filterInputBox.value = this.action.filterText;
		this._register(this.filterInputBox.onDidChange(filter => this.delayedFilterUpdate.trigger(() => this.onDidInputChange(this.filterInputBox!))));
		this._register(this.action.onDidChange((event: IMarkersFilterActionChangeEvent) => {
			if (event.filterText) {
				this.filterInputBox!.value = this.action.filterText;
			}
		}));
		this._register(DOM.addStandardDisposableListener(this.filterInputBox.inputElement, DOM.EventType.KEY_DOWN, (e: any) => this.onInputKeyDown(e, this.filterInputBox!)));
		this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_DOWN, this.handleKeyboardEvent));
		this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_UP, this.handleKeyboardEvent));

		const focusTracker = this._register(DOM.trackFocus(this.filterInputBox.inputElement));
		this._register(focusTracker.onDidFocus(() => this.focusContextKey.set(true)));
		this._register(focusTracker.onDidBlur(() => this.focusContextKey.set(false)));
		this._register(toDisposable(() => this.focusContextKey.reset()));
	}

	private createControls(container: HTMLElement): void {
		const controlsContainer = DOM.append(container, DOM.$('.markers-panel-filter-controls'));
		this.createBadge(controlsContainer);
		this.createFilters(controlsContainer);
	}

	private createBadge(container: HTMLElement): void {
		const filterBadge = this.filterBadge = DOM.append(container, DOM.$('.markers-panel-filter-badge'));
		this._register(attachStylerCallback(this.themeService, { badgeBackground, badgeForeground, contrastBorder }, colors => {
			const background = colors.badgeBackground ? colors.badgeBackground.toString() : '';
			const foreground = colors.badgeForeground ? colors.badgeForeground.toString() : '';
			const border = colors.contrastBorder ? colors.contrastBorder.toString() : '';

			filterBadge.style.backgroundColor = background;

			filterBadge.style.borderWidth = border ? '1px' : '';
			filterBadge.style.borderStyle = border ? 'solid' : '';
			filterBadge.style.borderColor = border;
			filterBadge.style.color = foreground;
		}));
		this.updateBadge();
		this._register(this.filterController.onDidFilter(() => this.updateBadge()));
	}

	private createFilters(container: HTMLElement): void {
		const actionbar = this._register(new ActionBar(container, {
			actionViewItemProvider: action => {
				if (action.id === this.filtersAction.id) {
					return this.instantiationService.createInstance(FiltersDropdownMenuActionViewItem, action, this.action, this.actionRunner);
				}
				return undefined;
			}
		}));
		actionbar.push(this.filtersAction, { icon: true, label: false });
	}

	private onDidInputChange(inputbox: HistoryInputBox) {
		inputbox.addToHistory();
		this.action.filterText = inputbox.value;
		this.action.filterHistory = inputbox.getHistory();
	}

	private updateBadge(): void {
		if (this.filterBadge) {
			const { total, filtered } = this.filterController.getFilterStats();
			DOM.toggleClass(this.filterBadge, 'hidden', total === filtered || filtered === 0);
			this.filterBadge.textContent = localize('showing filtered problems', "Showing {0} of {1}", filtered, total);
			this.adjustInputBox();
		}
	}

	private adjustInputBox(): void {
		if (this.element && this.filterInputBox && this.filterBadge) {
			this.filterInputBox.inputElement.style.paddingRight = DOM.hasClass(this.element, 'small') || DOM.hasClass(this.filterBadge, 'hidden') ? '25px' : '150px';
		}
	}

	// Action toolbar is swallowing some keys for action items which should not be for an input box
	private handleKeyboardEvent(event: StandardKeyboardEvent) {
		if (event.equals(KeyCode.Space)
			|| event.equals(KeyCode.LeftArrow)
			|| event.equals(KeyCode.RightArrow)
			|| event.equals(KeyCode.Escape)
		) {
			event.stopPropagation();
		}
	}

	private onInputKeyDown(event: StandardKeyboardEvent, filterInputBox: HistoryInputBox) {
		let handled = false;
		if (event.equals(KeyCode.Escape)) {
			filterInputBox.value = '';
			handled = true;
		}
		if (handled) {
			event.stopPropagation();
			event.preventDefault();
		}
	}

	protected updateClass(): void {
		if (this.element && this.container) {
			this.element.className = this.action.class || '';
			DOM.toggleClass(this.container, 'grow', DOM.hasClass(this.element, 'grow'));
			this.adjustInputBox();
		}
	}
}

export class QuickFixAction extends Action {

	public static readonly ID: string = 'workbench.actions.problems.quickfix';
	private static readonly CLASS: string = 'markers-panel-action-quickfix codicon-lightbulb';
	private static readonly AUTO_FIX_CLASS: string = QuickFixAction.CLASS + ' autofixable';

	private readonly _onShowQuickFixes = this._register(new Emitter<void>());
	readonly onShowQuickFixes: Event<void> = this._onShowQuickFixes.event;

	private _quickFixes: IAction[] = [];
	get quickFixes(): IAction[] {
		return this._quickFixes;
	}
	set quickFixes(quickFixes: IAction[]) {
		this._quickFixes = quickFixes;
		this.enabled = this._quickFixes.length > 0;
	}

	autoFixable(autofixable: boolean) {
		this.class = autofixable ? QuickFixAction.AUTO_FIX_CLASS : QuickFixAction.CLASS;
	}

	constructor(
		readonly marker: Marker,
	) {
		super(QuickFixAction.ID, Messages.MARKERS_PANEL_ACTION_TOOLTIP_QUICKFIX, QuickFixAction.CLASS, false);
	}

	run(): Promise<void> {
		this._onShowQuickFixes.fire();
		return Promise.resolve();
	}
}

export class QuickFixActionViewItem extends ActionViewItem {

	constructor(action: QuickFixAction,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super(null, action, { icon: true, label: false });
	}

	public onClick(event: DOM.EventLike): void {
		DOM.EventHelper.stop(event, true);
		this.showQuickFixes();
	}

	public showQuickFixes(): void {
		if (!this.element) {
			return;
		}
		if (!this.isEnabled()) {
			return;
		}
		const elementPosition = DOM.getDomNodePagePosition(this.element);
		const quickFixes = (<QuickFixAction>this.getAction()).quickFixes;
		if (quickFixes.length) {
			this.contextMenuService.showContextMenu({
				getAnchor: () => ({ x: elementPosition.left + 10, y: elementPosition.top + elementPosition.height + 4 }),
				getActions: () => quickFixes
			});
		}
	}
}

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {
	const inputActiveOptionBorderColor = theme.getColor(inputActiveOptionBorder);
	if (inputActiveOptionBorderColor) {
		collector.addRule(`.markers-panel-action-filter > .markers-panel-filter-controls > .monaco-action-bar .action-label.markers-filters.checked { border-color: ${inputActiveOptionBorderColor}; }`);
	}
	const inputActiveOptionBackgroundColor = theme.getColor(inputActiveOptionBackground);
	if (inputActiveOptionBackgroundColor) {
		collector.addRule(`.markers-panel-action-filter > .markers-panel-filter-controls > .monaco-action-bar .action-label.markers-filters.checked { background-color: ${inputActiveOptionBackgroundColor}; }`);
	}
});
