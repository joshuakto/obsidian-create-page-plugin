import { Editor, MarkdownView, Notice, Plugin, TFile} from 'obsidian';
import * as path from "path";
import {addMissingInternalLink, parseCardBlock, parseMDFile} from "./helper";
import {LinkedBlock} from "./type";
import CardifySettingTab from "./class/CardifySettingTabClass";
import SampleModal from "./class/SampleModalClass";
import CardifySettings from "./interface/ICardifySettings";

const DEFAULT_SETTINGS: CardifySettings = {
	separatorName: 'empty line',
	// separator: /\n{2,}/, // by default, card are separated by 2 or more new line symbols
	separator: '\n{2,}', // by default, card are separated by 2 or more new line symbols
}
export default class Cardify extends Plugin {
	settings: CardifySettings;

	async createNewFileContent(content: string, activeFilePath: string): Promise<Array<LinkedBlock>|null> {
		const rSeparator = new RegExp(this.settings.separator)
		const cardBlocks: Array<string> = content.split(rSeparator);
		const nonEmptyBlocks: Array<string> = cardBlocks.filter(
			(block: string): boolean => block.trim().length > 0
		)
		return nonEmptyBlocks.map(
			(block: string): LinkedBlock => {
				return parseCardBlock(block, activeFilePath);
			});
	}
	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Cardify', async (evt: MouseEvent) => {
			// Check that the active file is a md file
			const activeFile: TFile | null = this.app.workspace.getActiveFile()
			if (activeFile === null ) {
				new Notice('Cannot get active file.')
				return null
			}
			if (activeFile.extension !== 'md') {
				new Notice('Active file is not a markdown file.')
				return null
			}
			const activeFileBaseName: string = path.basename(activeFile.name, '.md')
			const activeDir:string = path.dirname(activeFile.path)

			// create folder to store generated md if folder does not exist yet
			const generatedFolder: string = activeDir + '/' + activeFileBaseName
			if (!await this.app.vault.adapter.exists(generatedFolder)) {
				await this.app.vault.createFolder(generatedFolder);
			}

			// extract file frontmatter and content from activeFile
			const fileContent: string = await this.app.vault.read(activeFile);
			const {frontMatter, content}: {frontMatter: string | null, content: string} = parseMDFile(fileContent);

			// edit content to add missing internal link
			const frontMatterString: string = frontMatter? frontMatter : '';
			const linkedContent: string = addMissingInternalLink(content, this.settings.separator)

			// add internal link to blocks if a link is not detected for a block (link is in the form of \n^<id>)
			await this.app.vault.process(activeFile, (data: string) => {
				return frontMatterString + linkedContent
			});

			// parse file content from activeFile into separate md files
			const newFileContent = await this.createNewFileContent(linkedContent, activeFile.path);
			if (!newFileContent) {return new Notice('No new content');}

			// write parsed content into new md files
			newFileContent.map(async (lb: LinkedBlock, idx: number) => {
				// extract comment from the content to use as filename
				const filename: string = lb.title === '' ? idx.toString() : idx.toString() + '-' + lb.title
				await this.app.vault.create(generatedFolder + '/' + filename + '.md', lb.link)
			})
			new Notice('New files stored in ' + generatedFolder)
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}
					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CardifySettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = DEFAULT_SETTINGS
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
