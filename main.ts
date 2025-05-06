import { normalizePath, Workspace, WorkspaceLeaf, TFile, App, Editor, MarkdownView, Notice, Plugin, FileSystemAdapter, Setting, PluginSettingTab, getFrontMatterInfo } from 'obsidian';
// import * as fs from 'fs';
import * as path from 'path';
import { exit } from 'process';
import { C2DSettingTab } from './settings';

interface C2DSettings {
	usefrontmatter: boolean,
	useedgelabels: boolean,
	autooverwrite: boolean
}

const DEFAULT_SETTINGS: Partial<C2DSettings> = {
	usefrontmatter: true,
	useedgelabels: true,
	autooverwrite: false
};


export class C2DSettingTab extends PluginSettingTab {
	plugin: Canvas2DocumentPlugin;
  
	constructor(app: App, plugin: Canvas2DocumentPlugin) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
  
	display(): void {
	  let { containerEl } = this;
  
	  containerEl.empty();
  
	  new Setting(containerEl)
		.setName('Include YAML frontmatter from embedded documents')
		.setDesc('Makes metadata from embedded documents usable in target document')
		.addToggle(toggle =>
			toggle.setValue(this.plugin.settings.usefrontmatter)
			.onChange(async (value) => {
			  this.plugin.settings.usefrontmatter = value;
			  await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl)
		.setName('Include labels of canvas edges (connections)')
		.setDesc('Makes connections descriptions usable in target document')
		.addToggle(toggle =>
			toggle.setValue(this.plugin.settings.useedgelabels)
			.onChange(async (value) => {
			  this.plugin.settings.useedgelabels = value;
			  await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl)
		.setName('Overwrite existing target documents without confirmation')
		.setDesc('User confirmation is not needed to overwrite existing target documents')
		.addToggle(toggle =>
			toggle.setValue(this.plugin.settings.autooverwrite)
			.onChange(async (value) => {
			  this.plugin.settings.autooverwrite = value;
			  await this.plugin.saveSettings();
			})
		);

	}
  }

export default class Canvas2DocumentPlugin extends Plugin {
	fsadapter: FileSystemAdapter;

	async onload() {
		await this.loadSettings();
	
		this.addSettingTab(new C2DSettingTab(this.app, this));

		// this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 } else {
			//TODO throw exception for fsadapter
			return
		 }

		this.addCommand({
			id: "run-conversion",
			name: "Step 1 - Convert canvas to a longform document",
			callback: async () => {
				const canvStruct = await this.readCanvasStruct();
				if (canvStruct == false) {
					new Notice(`this is not a canvas file`);
					return;
				}

				let [contents, myparsed_data] = await this.readCanvasData(canvStruct);

				const result = await this.writeCanvDocFile(contents, canvStruct, myparsed_data);

			},
		});

		this.addCommand({
			id: "run-redoc",
			name: "Step 2 - Clear canvas2document target document",
			callback: async () => {
				const canvStruct = await this.readC2Dtarget();
				if (canvStruct == false) {
					new Notice(`this is not a canvas2document target file`);
					return;
				}
				this.writeC2Doc(canvStruct);
			},
		});

		this.addRibbonIcon("image-down", "C2D Step 1 - Convert Canvas to draft doc", () => {
			this.app.commands.executeCommandById("canvas2document:run-conversion");
		});
		
		this.addRibbonIcon("file-input", "C2D Step 2 - Make cleared document", () => {
			this.app.commands.executeCommandById("canvas2document:run-redoc");
		});

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}


	onunload() {
		// TODO: cleaning up
	}

	async readC2Dtarget(): Promise<number> {
		/*
		check on active file is canvas
		*/
		let activeFile = this.app.workspace.getActiveFile();

		//filename of the active file contains "_fromCanvas.md"
		if (!activeFile || !activeFile.name.includes("_fromCanvas.md")) {
			return false;
		} else {
			let mdFolderPath: string = path.dirname(activeFile.path);
		}

		// TODO: prevent reading all files, just the active file, if canvas check ok

		//let actcanvasfile = app.vault.getAbstractFileByPath(activeFile);
		let content = this.app.vault.cachedRead(activeFile);

		return content;
	}	

	async writeC2Doc(canvStruct) {

		let activeFile = this.app.workspace.getActiveFile();
		let mdFolderPath: string = path.dirname(activeFile.path);

		const regex = /\!\[\[([^[\]]+)\]\]|<iframe\s+[^>]*src="(.*?)"/g;

		const matches: { type: string; value: string }[] = [];
		let match;
		while ((match = regex.exec(canvStruct)) !== null) {
			if (match[1]) {
				matches.push(match[1]);
			} else if (match[2]) {
				matches.push(match[2]);
			}
		}

		const edgelabelpattern = /<edgelabel\s+(?:data="(.*?)")?>(.*?)<\/edgelabel>/g;
		const matchesedgelabel: { content: string; data?: string }[] = [];

		let matchel;
		while ((matchel = edgelabelpattern.exec(canvStruct)) !== null) {
			matchesedgelabel.push({
				data: matchel[1], // Captured `data` attribute (optional)
				content: matchel[2], // Captured inner content
			});
		}

		let doccontentstring = "> [!success] This is your converted and cleared document from Canvas2Document\n\> (you can delete this infobox)\n\n"

		if (! matches) {
			return
		}

		let textfilenames = []
		let filenames = []

		matches.forEach(match => {
			let embeddedfilename = match.replace(/\!\[\[(.*)\]\]/, '$1');

			if (embeddedfilename.endsWith(".md")) {
				// if embeddedfilename starts with "./" remove it
				if (embeddedfilename.startsWith("./")) {
					embeddedfilename = embeddedfilename.replace("./", "")
				}
				textfilenames.push(embeddedfilename);
			} 

			filenames.push(embeddedfilename);
		});

		const fileContents = await Promise.all(
			textfilenames.map(
			async (file) => [file, await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(file))] as const,
			//   async (file) => [file, await this.app.vault.adapter.read(file)] as const,
			),
	    );

		for (const xfile of filenames) {

			if (this.settings.useedgelabels) {

				matchesedgelabel.forEach(label => {
					if (xfile === label.data) {
						doccontentstring += "> [!info] (edge label in canvas for the following entry:) \"" + label.content + "\"\n\n"
					}
				});	

			}


			if (xfile.endsWith(".md")) {
				const found = fileContents.find((element) => element[0] == xfile);

				const { dir, name, ext } = path.parse(xfile);

				if (! dir.endsWith("_canvas2doc-data")) {
					doccontentstring += "# " + name + "\n\n"
				}

				const frontMatterInfo = getFrontMatterInfo(found[1]);

				let textfilestring = ""
				
				if (this.settings.usefrontmatter && frontMatterInfo.exists) {
					textfilestring = found[1]
				} else {
					textfilestring = found[1].substring(frontMatterInfo.contentStart);
				}

				doccontentstring += textfilestring + "\n\n"
			} else if (xfile.startsWith("http")) {
				doccontentstring += "<iframe width=500 height=300 src=\"" + xfile + "\"></iframe>\n\n"
			} else {
				doccontentstring += "![[" + xfile + "]]\n\n"
			}
		}

		let docFilename
		if (mdFolderPath == ".") {
	    	docFilename = activeFile.basename + "_final.md"
		} else {
			docFilename = mdFolderPath + "/" + activeFile.basename + "_final.md"					
		}

		try {
			const exists = await this.fsadapter.exists(docFilename);

			if (exists && !this.settings.autooverwrite) {
			  const confirmed = await new Promise(resolve => {
				const notice = new Notice('File ' + docFilename + ' already exists. Overwrite?', 0);
				notice.noticeEl.createEl('button', {text: 'Yes'}).onclick = () => {
				  notice.hide();
				  resolve(true);
				};
				notice.noticeEl.createEl('button', {text: 'No'}).onclick = () => {
				  notice.hide();
				  resolve(false);
				};
			  });
			  
			  if (!confirmed) {
				return false; // User chose not to overwrite
			  }
			}
			
			await this.fsadapter.write(docFilename, doccontentstring);

			// await this.app.vault.create(docFilename, doccontentstring)
		} catch (e) {
			console.log("error writing the new cleared doc file " + e)
		}

		const docftab = await this.app.vault.getAbstractFileByPath(docFilename);

		try {
			await this.app.workspace.getLeaf('split').openFile(docftab);
		} catch (e) {
			console.log(e)
		}
		return
	}

	async readCanvasStruct(): Promise<number> {
		/*
		check on active file is canvas
		*/
		let activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension != "canvas") {
			return false;
		} else {
			let mdFolderPath: string = path.dirname(activeFile.path);
		}

		// TODO: prevent reading all files, just the active file, if canvas check ok

		//let actcanvasfile = app.vault.getAbstractFileByPath(activeFile);
		let content = this.app.vault.cachedRead(activeFile);
		return content;
	}	

	async findAllXChildren(startGeneration, myparsed_data, fileContents, handledNodes, limitrecurseNodes, runcounterfunc, runcounterforeach):Promise<boolean> {

		runcounterfunc++
		if (runcounterfunc > 30) {
			return false
		}

		for (const child of startGeneration) {
			runcounterforeach++
			if (runcounterforeach > myparsed_data.edges2.length) {
				return false
			}

			const nodeentry = myparsed_data.nodes.find(entry => entry.id === child);
	
			if (! handledNodes.has(child)) {
				const result = await this.formatNode(nodeentry, 6)
				fileContents.push(result);
				handledNodes.add(child);
			} else {
				limitrecurseNodes++

				if (limitrecurseNodes > 30) {
					return false
				}
			}

			let children = myparsed_data.edges2.filter(edge => edge.fromNode === child).map(edge => edge.toNode);
			
			if (children.length > 0) {
				const continueRecursion = await this.findAllXChildren(children, myparsed_data, fileContents, handledNodes, limitrecurseNodes, runcounterfunc, runcounterforeach);
				if (!continueRecursion) return false;
			}
		};

		limitrecurseNodes++
		return limitrecurseNodes <= 30
	}

	
	async traverseNodes(initialNodes, myparsed_data, fileContents, handledNodes) {

		for (const node of initialNodes) {

			const nodeentry = myparsed_data.nodes.find(entry => entry.id === node);

			// is  skiphandledNodes is true, check if node is already handled
			if (! handledNodes.has(node)) {
				const result = await this.formatNode(nodeentry, 1);
				fileContents.push(result);
			}

			handledNodes.add(node);

			const children1 = myparsed_data.edges2
			.filter(edge => edge.fromNode === node)
			.map(edge => edge.toNode);
	
			for (const child1 of children1) {
		
				const nodeentry = myparsed_data.nodes.find(entry => entry.id === child1);

				if (! handledNodes.has(child1)) {
					const result = await this.formatNode(nodeentry, 2);
					fileContents.push(result);
				}

				handledNodes.add(child1);
	
				const children2 = myparsed_data.edges2
				.filter(edge => edge.fromNode === child1)
				.map(edge => edge.toNode);
		
				for (const child2 of children2) {

					const nodeentry = myparsed_data.nodes.find(entry => entry.id === child2);

					if (! handledNodes.has(child2)) {
						const result = await this.formatNode(nodeentry, 3);
						fileContents.push(result);
					}

					handledNodes.add(child2);

					const children3 = myparsed_data.edges2
					.filter(edge => edge.fromNode === child2)
					.map(edge => edge.toNode);
		
				
					for (const child3 of children3) {
		
						const nodeentry = myparsed_data.nodes.find(entry => entry.id === child3);

						if (! handledNodes.has(child3)) {
							const result = await this.formatNode(nodeentry, 4);
							fileContents.push(result);
						}
						
						handledNodes.add(child3);

						const children4 = myparsed_data.edges2
						.filter(edge => edge.fromNode === child3)
						.map(edge => edge.toNode);
		
						for (const child4 of children4) {
		
							const nodeentry = myparsed_data.nodes.find(entry => entry.id === child4);

							if (! handledNodes.has(child4)) {
								const result = await this.formatNode(nodeentry, 5);
								fileContents.push(result);
							}

							handledNodes.add(child4);
			
							const children5 = myparsed_data.edges2
							.filter(edge => edge.fromNode === child4)
							.map(edge => edge.toNode);
		

							for (const child5 of children5) {
							
								const nodeentry = myparsed_data.nodes.find(entry => entry.id === child5);
	
								if (! handledNodes.has(child5)) {
									const result = await this.formatNode(nodeentry, 6);
									fileContents.push(result);
								}

								handledNodes.add(child5);
				
								const children6 = myparsed_data.edges2.filter(edge => edge.fromNode === child5).map(edge => edge.toNode);

								// now turn to infinity -> findAllXChildren()							
								let runcounterfunc: number = 0
								let runcounterforeach: number = 0
								let limitrecurseNodes: number = 0

								const result = await this.findAllXChildren(children6, myparsed_data, fileContents, handledNodes, limitrecurseNodes, runcounterfunc, runcounterforeach);
							}
						}
					}
				}
			}
		}
	}

	async readCanvasData(struct) {
		// TODO: nochmal nach https://docs.obsidian.md/Plugins/Vault, read all files
		// input liste eben aus canvas-JSON alle nodes

		const fileContents: [string, string, string, number, string, string][] = [];

		let myparsed_data = JSON.parse(struct);

		const singleNodeIDs = new Set();
		const groupNodes = new Set();

		myparsed_data.nodes.forEach(node => {
			if (node.type === "group") {
				// TODO later we also handle groups
				groupNodes.add(node.id);
			} else {
				singleNodeIDs.add(node.id);
			}
		});

		// Extract unique fromNodes and toNodes
		const fromNodes = new Set();
		const toNodes = new Set();
		let groupClearedEdges = [];

		let resa = await myparsed_data.edges.forEach(edge => {

			// TODO later we also handle groups
			if (groupNodes.has(edge.fromNode) || groupNodes.has(edge.toNode)) {
				// remove edge from myparsed_data
			} else {
				fromNodes.add(edge.fromNode);
				toNodes.add(edge.toNode);
				groupClearedEdges.push(edge)
			}
		});
		myparsed_data.edges2=groupClearedEdges;

		let handledNodes = new Set();
		// TODO make this a setting
		const skiphandledNodes = true

		let nodesWithoutParents = [...singleNodeIDs].filter(node => !toNodes.has(node));

		if (nodesWithoutParents.length === 0) {
			nodesWithoutParents = [...singleNodeIDs];
		}

		// first round of nodes without parents
		const traverseresult = await this.traverseNodes(nodesWithoutParents, myparsed_data, fileContents, handledNodes);

		const diff = new Set([...singleNodeIDs].filter(x => !handledNodes.has(x)));
		
		// if diff is not empty, we have nodes without parents and give them to findAllXChildren again
		if (diff.size > 0) {
			const traverseresult = await this.traverseNodes(diff, myparsed_data, fileContents, handledNodes);
		}

		return [fileContents, myparsed_data];
	}

	async formatNode(node, level): Promise<[string, string, string, number, string, string]> {
		const id = node.id;
		const type = node.type;
		let nodefile = "";

		if (type === "file") {
			nodefile = node.file;

			const { name, ext } = path.parse(nodefile);

			if (ext === ".md") {
				return [id, type, nodefile, level, "textfile", name];
			} else if (ext === ".canvas") {
				return [id, type, nodefile, level, "embeddedcanvas", name];
			} else if (ext === ".jpg" || ext == ".jpeg" || ext === ".png" || ext === ".gif") {
				return [id, type, nodefile, level, "contentimage", name + "." + ext];
			} else if (ext === ".mp3" || ext === ".wav" || ext === ".ogg") {
				return [id, type, nodefile, level, "contentaudio", name + "." + ext];
			} else if (ext === ".mp4" || ext === ".webm") {
				return [id, type, nodefile, level, "contentvideo", name + "." + ext];
			} else if (ext === ".pdf") {
				return [id, type, nodefile, level, "contentpdf", name + "." + ext];
			} else {
				return [id, type, nodefile, level, "xfile", name + "." + ext];
			}
		} else if (type === "link") {
			if (node.url.includes("youtube")) {
				const url = node.url;
				return [id, type, url, level, "contentyoutube", node.url];
			} else {
				return [id, type, node.url, level, "contentlink", node.url];
			}
		} else if (type === "text") {
			const text = node.text;
			// get first 100 chars of text
			const textPreview = text.substring(0, 100);

			return [id, type, "node", level, text, textPreview];
		}
	}
	
	async writeCanvDocFile(content, convStruct, myparsed_data) {
		// establishing the workdir

		let activeFile = this.app.workspace.getActiveFile();
		let mdFolderPath: string = path.dirname(activeFile.path);

		let writeworkdir = mdFolderPath + "/" + activeFile.basename + "_canvas2doc-data"
		this.fsadapter.mkdir(writeworkdir)

		let canvasFile
		let canvasFilename
		if (mdFolderPath == ".") {
	    	canvasFilename = activeFile.basename + "_fromCanvas.md"
		} else {
			canvasFilename = mdFolderPath + "/" + activeFile.basename + "_fromCanvas.md"					
		}

		let contentString = "> [!info] This is an automatically generated document from Plugin [Canvas2Document](https://github.com/slnsys/obsidian-canvas2document)\n\> arrange the document as you need with the outline, then call *Clear canvas2document target document*\n\n"


		for (const element of content) {
			
			let cnfname = ""

			// place number of # according to level
			let heading = ""

			for (let i = 0; i < element[3]; i++) {
				heading += "#"
			}
			
			if (element[1] == "text") {
				
				cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + "_fromCanvas.md"
				
				contentString += "\n\n" + heading + " _card " + element[5] + "\n"
				contentString += element[2] + " ^" + element[0] + "\n\n"
				contentString += "> [!tip] link navigation from the canvas\n"

				for (const edge of myparsed_data.edges2) {
					if (edge.fromNode == element[0]) {
						const found = content.find((element) => element[0] == edge.toNode);
						const firstline = found[5].split('\n')[0]
						const found5 = firstline.replace(/#/g, "")

						contentString += "> linking to: [[#^" + edge.toNode + "|" + found5 + "]]\n"
					} 
					if (edge.toNode == element[0]) {
						const found = content.find((element) => element[0] == edge.fromNode);
						const firstline = found[5].split('\n')[0]
						const found5 = firstline.replace(/#/g, "")

						if (edge.label != undefined) {
							const sanitizedLabel = edge.label.replace(/\n/g, " - ");
							contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]] " + "(\"<edgelabel data=\"" + cnfname + "\">" + sanitizedLabel + "</edgelabel>\")\n";
						} else {
							contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]]\n";
						}

					} 
				}

				//Embedding
				contentString += "\n ![[" + cnfname + "]]\n\n"

				let canvasnodeFile

				try {
					let cnfabst = this.app.vault.getAbstractFileByPath(cnfname);
					await this.fsadapter.write(cnfname, element[4])
				} catch (e) {
					console.log(e)
					return
				}	

			} else if (element[1] == "link") {
				// cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + " _fromCanvas.md"

				contentString += "\n\n" + heading + " _link " + element[5] + "\n"
				contentString += element[2] + " ^" + element[0] + "\n\n"
				contentString += "> [!tip] link navigation from the canvas\n"

				for (const edge of myparsed_data.edges2) {
					if (edge.fromNode == element[0]) {
						const found = content.find((element) => element[0] == edge.toNode);
						const firstline = found[5].split('\n')[0]
						const found5 = firstline.replace(/#/g, "")

						contentString += "> linking to: [[#^" + edge.toNode + "|" + found5 + "]]\n"
					} 
					if (edge.toNode == element[0]) {
						const found = content.find((element) => element[0] == edge.fromNode);
						const firstline = found[5].split('\n')[0]
						const found5 = firstline.replace(/#/g, "")

						if (edge.label != undefined) {
							const sanitizedLabel = edge.label.replace(/\n/g, " - ");
							contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]] " + "(\"<edgelabel data=\"" + element[2] + "\">" + sanitizedLabel + "</edgelabel>\")\n"
						} else {
							contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]]\n"
						}

					} 
				}

				//Embedding media specific
				// TODO also add navigational title data to element metabox
				if (element[4] == "contentyoutube") {
					contentString += "\n ![](" + element[2] + ")\n\n"
				} else if (element[4] == "contentlink") {
					contentString += "\n <iframe width=500 height=300 src=\"" + element[2] + "\"></iframe>\n\n"
				}

			} else if (element[1] == "file") {
				if (element[4] == "contentimage" || element[4] == "contentpdf") {

					contentString += "\n\n" + heading + " _Media " + element[5] + "\n"
					contentString += element[2] + " ^" + element[0] + "\n\n"
					// TODO linking box noch in funktion auslagern
					contentString += "> [!tip] link navigation from the canvas\n"

					for (const edge of myparsed_data.edges2) {
						if (edge.fromNode == element[0]) {
							const found = content.find((element) => element[0] == edge.toNode);
							const firstline = found[5].split('\n')[0]
							const found5 = firstline.replace(/#/g, "")

							contentString += "> linking to: [[#^" + edge.toNode + "|" + found5 + "]]\n"

						} 
						if (edge.toNode == element[0]) {
							const found = content.find((element) => element[0] == edge.fromNode);
							const firstline = found[5].split('\n')[0]
							const found5 = firstline.replace(/#/g, "")	

							if (edge.label != undefined) {
								const sanitizedLabel = edge.label.replace(/\n/g, " - ");
								contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]] " + "(\"<edgelabel data=\"" + element[2] + "\">" + sanitizedLabel + "</edgelabel>\")\n"
							} else {
								contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]]\n"
							}

						} 
					}
					// starttag meta data block
					// contentString += "\n%%\ncanvas2document plugin metadata header end\n%%\n"
				
					//Embedding media specific
					if (element[4] == "contentpdf") {
						contentString += "\n ![[" + element[2] + "]]\n\n"
					} else if (element[4] == "contentimage") {
						contentString += "\n ![[" + element[2] + "]]\n\n"
					}				

				} else {
					// TODO confirm, that file is md, not the else case

					contentString += "\n\n" + heading + " _noteFile " + element[5] + "\n"
					contentString += element[2] + " ^" + element[0] + "\n\n"
					contentString += "> [!tip] link navigation from the canvas\n"

					for (const edge of myparsed_data.edges2) {

						if (edge.fromNode == element[0]) {
							const found = content.find((element) => element[0] == edge.toNode);
							const firstline = found[5].split('\n')[0]
							const found5 = firstline.replace(/#/g, "")

							contentString += "> linking to: [[#^" + edge.toNode + "|" + found5 + "]]\n"

						} 
						if (edge.toNode == element[0]) {
							const found = content.find((element) => element[0] == edge.fromNode);
							const firstline = found[5].split('\n')[0]
							const found5 = firstline.replace(/#/g, "")	

							if (edge.label != undefined) {
								const sanitizedLabel = edge.label.replace(/\n/g, " - ");
								contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]] " + "(\"<edgelabel data=\"" + element[2] + "\">" + sanitizedLabel + "</edgelabel>\")\n"
							} else {
								contentString += "> linked from: [[#^" + edge.fromNode + "|" + found5 + "]]\n"
							}
						} 
					}
				
					// Embedding
					contentString += "\n ![[" +  element[2] + "]]\n\n"
				}
			}
		}

   	    try {
				const exists = await this.fsadapter.exists(canvasFilename);
				
				if (exists && !this.settings.autooverwrite) {
					const confirmed = await new Promise(resolve => {
						const notice = new Notice('File ' + canvasFilename + ' already exists. Overwrite?', 0);
						notice.noticeEl.createEl('button', {text: 'Yes'}).onclick = () => {
						notice.hide();
						resolve(true);
						};
						notice.noticeEl.createEl('button', {text: 'No'}).onclick = () => {
						notice.hide();
						resolve(false);
						};
				    });
				  
				  if (!confirmed) {
					return false; // User chose not to overwrite
				  }
				}
				
				await this.fsadapter.write(canvasFilename, contentString);

	    //   canvasFile = await this.app.vault.create(canvasFilename, contentString)
	    } catch (e) {
			console.log("error writing the new doc file " + e)
		}
		
		const cnfabst = await this.app.vault.getAbstractFileByPath(canvasFilename);

		try {
			await this.app.workspace.getLeaf('split').openFile(cnfabst);
		} catch (e) {
			console.log(e)
		}
		return true

	}
}
