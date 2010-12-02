/*
    ***** BEGIN LICENSE BLOCK *****
	
	Copyright (c) 2009  Zotero
	                    Center for History and New Media
						George Mason University, Fairfax, Virginia, USA
						http://zotero.org
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const ZOTEROMACWORDINTEGRATION_ID = "zoteroMacWordIntegration@zotero.org";
const ZOTEROMACWORDINTEGRATION_PREF = "extensions.zoteroMacWordIntegration.version";

function ZoteroMacWordIntegration_checkVersion(name, url, id, minVersion) {
	// check Zotero version
	try {
		var ext = Components.classes['@mozilla.org/extensions/manager;1']
		   .getService(Components.interfaces.nsIExtensionManager).getItemForID(id);
		var comp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
			.getService(Components.interfaces.nsIVersionComparator)
			.compare(ext.version, minVersion);
	} catch(e) {
		var comp = -1;
	}
	
	if(comp < 0) {
		var err = 'This version of Zotero MacWord Integration requires '+name+' '+minVersion+
			' or later to run. Please download the latest version of '+name+' from '+url+'.';
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService)
			.alert(null, 'Zotero Word Integration Error', err);
		throw err;
	}
}

function ZoteroMacWordIntegration_restartFirefox() {	
	// The following code was borrowed from extensions.js
	// Notify all windows that an application quit has been requested.
	var os = Components.classes["@mozilla.org/observer-service;1"]
					   .getService(Components.interfaces.nsIObserverService);
	var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
							   .createInstance(Components.interfaces.nsISupportsPRBool);
	os.notifyObservers(cancelQuit, "quit-application-requested", "restart");
	
	// Something aborted the quit process.
	if (cancelQuit.data)
	return;
	
	Components.classes["@mozilla.org/toolkit/app-startup;1"].getService(Components.interfaces.nsIAppStartup)
			  .quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit);
}

function ZoteroMacWordIntegration_clearComponentCache() {
	// Delete relevant files
	var profileDirectory = Components.classes["@mozilla.org/file/directory_service;1"]
									 .getService(Components.interfaces.nsIProperties)
									 .get("ProfD", Components.interfaces.nsIFile);
	for each(var filename in ["compreg.dat", "extensions.cache", "xpti.dat", "extensions.rdf"]) {
		var file = profileDirectory.clone();
		file.append(filename);
		if(file.exists()) file.remove(false);
	}
}

function ZoteroMacWordIntegration_firstRun() {
	try {
		// run AppleScript to set up
		var installScript = Components.classes["@zotero.org/Zotero/integration/installer?agent=MacWord;1"].
			createInstance(Components.interfaces.nsIRunnable);
		installScript.run();
	} catch(e) {
		var message = "";
			
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
		
		var messages = {};
		consoleService.getMessageArray(messages, {});
		messages = messages.value;
		if(messages && messages.length) {
			var lastMessage = messages[messages.length-1];
			try {
				var error = lastMessage.QueryInterface(Components.interfaces.nsIScriptError);
			} catch(e2) {
				if(lastMessage.message && lastMessage.message.substr(0, 12) == "ERROR:xpcom:") {
					// print just the last line of the message, but re-throw the rest
					message = lastMessage.message.substr(0, lastMessage.message.length-1);
					message = "\n"+message.substr(message.lastIndexOf("\n"))
				}
			}
		}
		
		if(!message && typeof(e) == "object" && e.message) message = e.message;
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService)
			.alert(null, "Zotero Word Integration could not complete installation because an error occurred.", message);
		throw e;
	}
}

function ZoteroMacWordIntegration_checkInstall() {
	var ext = Components.classes['@mozilla.org/extensions/manager;1']
	   .getService(Components.interfaces.nsIExtensionManager).getItemForID(ZOTEROMACWORDINTEGRATION_ID);
	var zoteroMacWordIntegration_prefService = Components.classes["@mozilla.org/preferences-service;1"].
		getService(Components.interfaces.nsIPrefBranch);
		
	ZoteroMacWordIntegration_checkVersion("Zotero", "zotero.org", "zotero@chnm.gmu.edu", "2.0b7.SVN");
	ZoteroMacWordIntegration_checkVersion("PythonExt", "zotero.org", "pythonext@mozdev.org", "2.5");
	
	var pythonExt = Components.classes['@mozilla.org/extensions/manager;1'].
		getService(Components.interfaces.nsIExtensionManager).
		getInstallLocation("pythonext@mozdev.org").
		getItemLocation("pythonext@mozdev.org");
	var pythonExtComponents = pythonExt.clone();
	pythonExtComponents.append("components");
	if(!pythonExtComponents.directoryEntries.hasMoreElements()) {
		var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService)
			.confirm(null, 'Zotero MacWord Integration Error',
			'Zotero MacWord Integration requires PythonExt to run. While PythonExt is currently '+
			'installed, it appears to be corrupted or incompletely deleted. As such, the Firefox '+
			'Add-on manager may not be able to remove or reinstall it. Would you like Zotero '+
			'Integration to remove it for you and restart Firefox?\n\n'+
			'Upon restart, you may receive an error '+
			'stating that PythonExt is not installed, and you will need to reinstall PythonExt '+
			'before Zotero MacWord Integration will function properly.');
		if(prompt) {
			pythonExt.remove(true);
			ZoteroMacWordIntegration_restartFirefox();
		}
		throw "PythonExt is missing the extension helper; Zotero MacWord Integration will not function."
	}
	
	if(zoteroMacWordIntegration_prefService.getCharPref(ZOTEROMACWORDINTEGRATION_PREF) != ext.version) {
		ZoteroMacWordIntegration_firstRun();
		zoteroMacWordIntegration_prefService.setCharPref(ZOTEROMACWORDINTEGRATION_PREF, ext.version);
	}
		
	// see if component is registered
	if(!Components.classes["@zotero.org/Zotero/integration/application?agent=MacWord2008;1"]) {		
		var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService)
			.confirm(null, 'Zotero MacWord Integration Error',
			'The Zotero MacWord Integration installation succeeded, but a necessary '+
			'component does not appear to be loaded properly. \n\nZotero can attempt to correct '+
			'this for you. A Firefox restart will be required. Continue?');
		if(prompt) {
			ZoteroMacWordIntegration_clearComponentCache();
			ZoteroMacWordIntegration_restartFirefox();
		}
		throw "The Zotero MacWord Integration Python component is not registered."
	}
}

window.addEventListener("load", function() {
	window.setTimeout(ZoteroMacWordIntegration_checkInstall, 1000);
}, false);