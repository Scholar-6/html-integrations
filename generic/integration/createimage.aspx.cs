using System;
using System.Collections;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Web;
using System.Web.SessionState;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Web.UI.HtmlControls;
using System.IO;

namespace pluginwiris
{
    public class createimage : System.Web.UI.Page
    {
		//Page_Load with some configuration is launched twice
		//The boolean load is to run it just once
		bool load = true;
        private void Page_Load(object sender, System.EventArgs e)
        {
			if (this.load){
				if (this.Request.Form["mml"] != null && this.Request.Form["mml"].Length > 0)
				{
					Hashtable properties = new Hashtable();
					properties["mml"] = this.Request.Form["mml"];
					
					foreach (string key in this.Request.Form.AllKeys)
					{
						if (key != null && (Libwiris.inArray(key, Libwiris.xmlFileAttributes) || (key.Length >= 4 && key.Substring(0, 4) == "font")))
						{
							properties[key] = this.Request.Form[key];
						}
					}
				
					Hashtable config = Libwiris.loadConfig(this.MapPath(Libwiris.configFile));
				
					string toSave = Libwiris.createIni(properties);
					string fileName = Libwiris.md5(toSave);
					string url = this.Page.ResolveUrl("showimage.aspx") + "?formula=" + fileName + ".png";
					string filePath = (Libwiris.getFormulaDirectory(config) != null) ? Libwiris.getFormulaDirectory(config) : this.MapPath(Libwiris.FormulaDirectory);
					filePath += "/" + fileName + ".ini";

					if (!File.Exists(filePath))
					{
						TextWriter file = new StreamWriter(filePath);
						file.Write(toSave);
						file.Close();
					}

					this.Response.Write(url);
				}
				else
				{
					this.Response.Write("Error: no mathml has been sent.");
				}			
				this.load = false;
			}
        }

        #region Web Form Designer generated code
        override protected void OnInit(EventArgs e)
        {
            //
            // CODEGEN: This call is required by the ASP.NET Web Form Designer.
            //
            InitializeComponent();
            base.OnInit(e);
        }

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.Load += new System.EventHandler(this.Page_Load);
        }
        #endregion
    }
}
