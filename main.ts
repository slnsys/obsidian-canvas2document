import { normalizePath, Workspace, WorkspaceLeaf, TFile, App, Editor, MarkdownView, Notice, Plugin, FileSystemAdapter } from 'obsidian';
// import * as fs from 'fs';
import * as path from 'path';

export default class Canvas2DocumentPlugin extends Plugin {
	fsadapter: FileSystemAdapter;

	async onload() {
	
		// this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.fsadapter = this.app.vault.adapter as FileSystemAdapter;
		 } else {
			//TODO throw exception for fsadapter
			return
		 }

		this.addCommand({
			id: "run-conversion",
			name: "Convert canvas to a longform document",
			callback: async () => {
				const canvStruct = await this.readCanvasStruct();
				if (canvStruct == false) {
					new Notice(`this is not a canvas file`);
					return;
				}

				const contents = await this.readCanvasData(canvStruct);

				this.writeCanvDocFile(contents, canvStruct);

			},
		});

		this.addCommand({
			id: "run-redoc",
			name: "Clear canvas2document target document",
			callback: async () => {
				const canvStruct = await this.readC2Dtarget();
				if (canvStruct == false) {
					new Notice(`this is not a canvas2document target file`);
					return;
				}

				// const contents = await this.readCanvasData(canvStruct);

				this.writeC2Doc(canvStruct);
			},
		});

	}

	onunload() {
		// TODO cleaning up
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

		// TODO also for links, not just embeddings
		const pattern = /\!\[\[([^[\]]+)\]\]/g;
		const matches = canvStruct.match(pattern);

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
			),
	    );

		for (const xfile of filenames) {
			if (xfile.endsWith(".md")) {
				const found = fileContents.find((element) => element[0] == xfile);
				doccontentstring += found[1] + "\n\n"
			} else {
				doccontentstring += "![[" + xfile + "]]\n\n"
			}
		}

		let docFilename
		if (mdFolderPath == ".") {
	    	docFilename = activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromC2D.md"
		} else {
			docFilename = mdFolderPath + "/" + activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromC2D.md"					
		}

		try {
			await this.app.vault.create(docFilename, doccontentstring)
		} catch (e) {
			console.log("error writing the new cleare doc file " + e)
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

	async findAllXChildren(node, level = 0) {
		console.log("level: " + level);
		const children = canvasData.edges
			.filter(edge => edge.fromNode === node)
			.map(edge => edge.toNode);
		
		children.forEach(child => {
			const grandchildren = findChildren(child, level + 1);
			children.push(...grandchildren);
		});
		
		return children;
	}
	
	// TODO diese wird die findDefinedChildren, nicht rekursiver call, sondern 2-3 mal -> 5 Mal like headings
	// dann der Rest über findAllXChrildren wird dann der letzten Ebene noch zugeordnet
	async findChildren(node) {
	
		const children1 = canvasData.edges
			.filter(edge => edge.fromNode === node)
			.map(edge => edge.toNode);
	
		// console.log("CHILDREN1")
		// console.log(children1)
		// hier alle Ebenen quasi teilrekursiv durchgehen, wenn keine gefunden, natürlich break
		children1.forEach(child1 => {
	
			const children2 = canvasData.edges
			.filter(edge => edge.fromNode === child1)
			.map(edge => edge.toNode);
	
			// console.log("CHILDREN2")
			// console.log(children2)
		
			children2.forEach(child2 => {
	
				const children3 = canvasData.edges
				.filter(edge => edge.fromNode === child2)
				.map(edge => edge.toNode);
	
				// console.log("CHILDREN3")
				// console.log(children3)
			
				children3.forEach(child3 => {
	
					const children4 = canvasData.edges
					.filter(edge => edge.fromNode === child3)
					.map(edge => edge.toNode);
	
					// console.log("CHILDREN4")
					// console.log(children4)
				
					children4.forEach(child4 => {
	
						const children5 = canvasData.edges
						.filter(edge => edge.fromNode === child4)
						.map(edge => edge.toNode);
	
						// console.log("CHILDREN5")
						// console.log(children5)
					
					});
		
				});
		
			});
	
			// children.push(...grandchildren);
		});
		
		// return children;
	}

	async readCanvasData(struct) {
		// TODO: nochmal nach https://docs.obsidian.md/Plugins/Vault, read all files
		// input liste eben aus canvas-JSON alle nodes

		const fileContents: [string, string, string, number, string][] = [];

		let  myparsed_data = JSON.parse(struct);
		console.log(myparsed_data)
		console.log("reading canvas data")


		const singleNodeIDs = new Set();
		myparsed_data.nodes.forEach(node => {
			singleNodeIDs.add(node.id);
		});

		// Extract unique fromNodes and toNodes
		const fromNodes = new Set();
		const toNodes = new Set();
		myparsed_data.edges.forEach(edge => {
			fromNodes.add(edge.fromNode);
			toNodes.add(edge.toNode);
		});

		let handledNodes = new Set();
		// TODO make this a setting
		const skiphandledNodes = true

		console.log("nodes"	)
		console.log(singleNodeIDs)
		console.log("fromNodes")
		console.log(fromNodes)
		console.log("toNodes: ")
		console.log(toNodes)


		const nodesWithoutParents = [...singleNodeIDs].filter(node => !toNodes.has(node));
		console.log("nodesWithoutParents: " + nodesWithoutParents)

		// TODO wenn nodeswithoutparents leer, liste alle node ids gleichwertig
		nodesWithoutParents.forEach(node => {

			const nodeentry = myparsed_data.nodes.find(entry => entry.id === node);

			// is  skiphandledNodes is true, check if node is already handled
			if (! handledNodes.has(node)) {
				this.formatNode(nodeentry, 1).then((result) => {
					fileContents.push(result);
				});	
			}

			handledNodes.add(node);

			const children1 = myparsed_data.edges
			.filter(edge => edge.fromNode === node)
			.map(edge => edge.toNode);
	
			// console.log("CHILDREN1")
			// console.log(children1)
			// TODO hier alle Ebenen quasi teilrekursiv durchgehen, wenn keine gefunden, natürlich break
			children1.forEach(child1 => {
		
				const nodeentry = myparsed_data.nodes.find(entry => entry.id === child1);

				if (! handledNodes.has(child1)) {
					this.formatNode(nodeentry, 2).then((result) => {
						fileContents.push(result);
					});
				} else {
					console.log("already handled: " + child1)
				}

				handledNodes.add(child1);
	
				const children2 = myparsed_data.edges
				.filter(edge => edge.fromNode === child1)
				.map(edge => edge.toNode);
		
				console.log("CHILDREN2")
				console.log(children2)
			
				children2.forEach(child2 => {

					const nodeentry = myparsed_data.nodes.find(entry => entry.id === child2);

					if (! handledNodes.has(child2)) {
						this.formatNode(nodeentry, 3).then((result) => {
							fileContents.push(result);
						});
					}

					handledNodes.add(child2);

					const children3 = myparsed_data.edges
					.filter(edge => edge.fromNode === child2)
					.map(edge => edge.toNode);
		
					console.log("CHILDREN3")
					console.log(children3)
				
					children3.forEach(child3 => {
		
						const nodeentry = myparsed_data.nodes.find(entry => entry.id === child3);

						if (! handledNodes.has(child3)) {
							this.formatNode(nodeentry, 4).then((result) => {
								fileContents.push(result);
							});
						}
						
						handledNodes.add(child3);

						const children4 = myparsed_data.edges
						.filter(edge => edge.fromNode === child3)
						.map(edge => edge.toNode);
		
						console.log("CHILDREN4")
						console.log(children4)
					
						children4.forEach(child4 => {
		
							const nodeentry = myparsed_data.nodes.find(entry => entry.id === child4);

							if (! handledNodes.has(child4)) {
								this.formatNode(nodeentry, 5).then((result) => {
									fileContents.push(result);
								});
							} else {
								console.log("already handled: " + child4)
							}

							handledNodes.add(child4);
			
							const children5 = myparsed_data.edges
							.filter(edge => edge.fromNode === child4)
							.map(edge => edge.toNode);
		
							console.log("CHILDREN5")
							console.log(children5)
						});
					});
				});
				// children.push(...grandchildren);
			});
			// return children;
		});
		console.log("fileContents")
		console.log(fileContents)
		return fileContents;
	}

	async formatNode(node, level): Promise<[string, string, string, number, string]> {
		const id = node.id;
		const type = node.type;
		let nodefile = "";

		if (type === "file") {
			nodefile = node.file;
			const { name, ext } = path.parse(nodefile);

			if (ext === ".md") {
				return [id, type, nodefile, level, "textfile"];
			} else if (ext === ".jpg" || ext == ".jpeg" || ext === ".png" || ext === ".gif") {
				return [id, type, nodefile, level, "contentimage"];
			} else if (ext === ".pdf") {
				return [id, type, nodefile, level, "contentpdf"];
			} else {
				//TODO handle unknown file type");
			}
		} else if (type === "link") {
			if (node.url.includes("youtube")) {
				const url = node.url;
				return [id, type, url, level, "contentyoutube"];
			} else {
				return [id, type, node.url, level, "contentlink"];
			}
		} else if (type === "text") {
			const text = node.text;
			return [id, type, "node", level, text];
		}
	}
	
	async writeCanvDocFile(content, convStruct) {
		// establishing the workdir
		let activeFile = this.app.workspace.getActiveFile();
		let mdFolderPath: string = path.dirname(activeFile.path);

		let writeworkdir = mdFolderPath + "/" + activeFile.basename + "_canvas2doc-data"
		this.fsadapter.mkdir(writeworkdir)

		let canvasFile
		let canvasFilename
		if (mdFolderPath == ".") {
	    	canvasFilename = activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromCanvas.md"
		} else {
			canvasFilename = mdFolderPath + "/" + activeFile.basename + "_" + Math.round(new Date().getTime()/1000) + "_fromCanvas.md"					
		}

		let contentString = "> [!info] This is an automatically generated document from Plugin [Canvas2Document](https://github.com/slnsys/obsidian-canvas2document)\n\> arrange the document as you need with the outline, then call *Clear canvas2document target document*\n\n"

		let myparsed_data = JSON.parse(convStruct);

		for (const element of content) {
			
			let cnfname = ""

			// place number of # according to level
			let heading = ""
			for (let i = 0; i < element[3]; i++) {
				heading += "#"
			}
			
			if (element[1] == "text") {
				
				cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + "_fromCanvas.md"
				
				// heading für navi links
				contentString += "\n\n" + heading + " ___card from Canvas\n"

				// Filename und interner link anchor
				contentString += element[2] + " ^" + element[0] + "\n\n"

				// linking box
				contentString += "> [!tip] link navigation from the canvas\n"
				for (const edge of myparsed_data.edges) {
					if (edge.fromNode == element[0]) {
						contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
					} 
					if (edge.toNode == element[0]) {
						contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
					} 
				}

				//Embedding
				contentString += "\n ![[" + cnfname + "]]\n\n"

			} else if (element[1] == "link") {
				// cnfname = writeworkdir + "/" + "newdoc-node_" + element[0] + " _fromCanvas.md"

				// heading für navi links
				contentString += "\n\n" + heading + " ___link from Canvas\n"

				// Filename und interner link anchor
				contentString += element[2] + " ^" + element[0] + "\n\n"

				// linking box
				contentString += "> [!tip] link navigation from the canvas\n"
				for (const edge of myparsed_data.edges) {
					if (edge.fromNode == element[0]) {
						contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
					} 
					if (edge.toNode == element[0]) {
						contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
					} 
				}

				//Embedding media specific
				if (element[4] == "contentyoutube") {
					contentString += "\n ![](" + element[2] + ")\n\n"
				} else if (element[4] == "contentlink") {
					contentString += "\n <iframe src=\"" + element[2] + "\"></iframe>\n\n"
				}

			} else if (element[1] == "file") {
				if (element[4] == "contentimage" || element[4] == "contentpdf") {

					// heading für navi links
					contentString += "\n\n" + heading + " ___Media from Canvas\n"
				
					contentString += element[2] + " ^" + element[0] + "\n\n"

					// linking box
					// TODO linking box noch in funktion auslagern
					contentString += "> [!tip] link navigation from the canvas\n"
					for (const edge of myparsed_data.edges) {
						if (edge.fromNode == element[0]) {
							contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
						} 
						if (edge.toNode == element[0]) {
							contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
						} 
					}
					// starttag meta data block
					// contentString += "\n%%\ncanvas2document plugin metadata header end\n%%\n"
				
					//Embedding media specific
					if (element[4] == "contentpdf") {
						contentString += "\n ![[" + element[2] + "#height=500]]\n\n"
					} else if (element[4] == "contentimage") {
						contentString += "\n ![[" + element[2] + "|500]]\n\n"
					}				

				} else {
					
					// heading für navi links
					contentString += "\n\n" + heading + " ___noteFile from Canvas\n"
				
					// Filename und interner link anchor
					contentString += element[2] + " ^" + element[0] + "\n\n"

					// linking box
					contentString += "> [!tip] link navigation from the canvas\n"
					for (const edge of myparsed_data.edges) {
						if (edge.fromNode == element[0]) {
							contentString += "> linking to: [[#^" + edge.toNode + "|canvaslink]]\n"
						} 
						if (edge.toNode == element[0]) {
							contentString += "> linked from: [[#^" + edge.fromNode + "|canvaslink]]\n"
						} 
					}
				
					// Embedding
					contentString += "\n ![[" +  element[2] + "]]\n\n"

				}
			}

			let canvasnodeFile

			try {
				let cnfabst = this.app.vault.getAbstractFileByPath(cnfname);
				this.app.vault.delete(cnfabst, true)
				canvasnodeFile = this.app.vault.create(cnfname, element[4])
			} catch (e) {
				console.log(e)
				return
			}	

		}

   	    try {
	      canvasFile = await this.app.vault.create(canvasFilename, contentString)
	    } catch (e) {
			console.log("error writing the new doc file " + e)
		}

		const cnfabst = await this.app.vault.getAbstractFileByPath(canvasFilename);

		try {
			await this.app.workspace.getLeaf('split').openFile(cnfabst);
		} catch (e) {
			console.log(e)
		}
		return

	}
}

