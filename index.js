/*
Application: Scobusy Application
Authors: Kyle Lipkin , Vitaliy Farber
Date: 12/12/2018

Notes: Need to work on the popup form validation and getting that going

*/

import React                                          from "react";
import { render }                                     from "react-dom";
import axios                                          from 'axios';
import _                                              from 'lodash'
import ReactTable                                     from "react-table";
import { Button }                                     from 'semantic-ui-react';
import alertify                                       from "alertifyjs";
import macHeaderLogo                                  from "./macHeaderLogo.png";
import ShoppingCenterDropDown                         from "./components/ShoppingCenterDropDown";
import CreateItem                                     from "./components/CreateItem";
import VarianceTable                                  from "./components/VarianceTable";
import Comments                                       from "./components/Comments";

import './App.css';
import 'core-js/es6/number';
import 'core-js/es6/array';
import 'core-js/fn/object/entries';
import 'core-js/fn/array/includes';
import 'semantic-ui-css/semantic.min.css';
import "react-table/react-table.css";
import "./macerich-react-table.css";
import "alertifyjs/build/css/alertify.min.css";
import "alertifyjs/build/css/themes/default.min.css";
import { CLIENT_RENEG_LIMIT } from "tls";

class App extends React.Component {
  _isMounted = false;

  constructor() {
    super();

    this.state = {
      shopCenter: 'Arrowhead Towne Center',
      lastUpdateDate: '',
      shopCenters: [],
      allPropertiesWithDates: [],
      loading: false,
      currentDate: '',
      createItemFormVisible: false,
      error: true,
      status: ''
    };

    this.onSearchChange = this.onSearchChange.bind(this);
    this.refreshSnapshot = this.refreshSnapshot.bind(this);
    
 }

  componentDidMount() {
    
    let initialCenters = [];
    
    axios('http://dlvsbl03:5000/api/properties')
   //axios('http://apps-dev.macerich.com/properties/')
      .then(response => {
        initialCenters = response.data.map((property) => {
          // Any center that has a lease will need to be projected, this code helps modify SC drop down results
          return property.ShopCenter_LeaseCount > 0 ? property.ShoppingCenter : null;
        });
        initialCenters.sort();
        const cleansedCenters = initialCenters.filter((x, i, a) => a.indexOf(x) === i)

        const allPropertiesWithDates = response.data.map((property) => {
          return {Center: property.ShoppingCenter,
                  LastUpdateDate: property.Scobusy_Updated ? 
                  new Date(property.Scobusy_Updated).toISOString().slice(0,10)+ ' '+
                  new Date(property.Scobusy_Updated).toLocaleTimeString('en-US')
                  : null};
                });

        this.setState({
          shopCenters: cleansedCenters,
          allPropertiesWithDates: allPropertiesWithDates
        });
        
      })
      .catch(error => {alert(error); this._isMounted && this.setState({ error })});

  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onSearchChange(scChange,event) {

    //Checking to make sure a shopping center is selected and not a bug with Semantic UI Dropdown
    if(scChange.length < 80){
      let lastUpdateDate = null;
      this.state.allPropertiesWithDates.forEach(function(record) {
        if (record.Center === scChange && !lastUpdateDate) {
          lastUpdateDate = record.LastUpdateDate
          
        }  
      });
      this.setState({shopCenter: scChange, loading:true, lastUpdateDate: lastUpdateDate});
      
    }
    // Catch a bug in the Semantic UI Dropdown when clicking off the field with no change
    else{
      event.preventDefault()
    }
  }

  refreshSnapshot() {
    var notification = alertify.notify('Snapshot is being Refreshed. It may take up to 5 minutes.', 'success', 1000, function(){  console.log('dismissed'); });
    axios('http://dlvsbl03:5000/api/properties')
    //axios('http://apps-dev.macerich.com/properties/')
      .then(response => {
          notification.dismiss();
          alertify.success('Snapshot is Refreshed');
      })
      .catch(error => {alert(error); this._isMounted && this.setState({ error })});

  }

  render() {
    
    // window.addEventListener('beforeunload', (event) => {
    //   event.returnValue = `Are you sure you want to leave?`;
    // });
    
    
    const {shopCenter,lastUpdateDate,shopCenters} = this.state;
    
    return (
      <div className="ui container">
        <header><img className="macHeaderLogo" src={macHeaderLogo} alt=''/><div style={{float:"right",fontSize:"20px", padding:"15px 0px 15px 50px", color:"white"}}>{this.state.shopCenter}</div></header>
        <div style={{textAlign:"center", paddingTop:"10px", paddingBottom:"20px", width: "100%"}} className="interactions">
        <table><tbody><tr><td>
          <ShoppingCenterDropDown
            values={shopCenters}
            value={shopCenter}
            onChange={(event) => this.onSearchChange(event.target.textContent,event)}
          >
          </ShoppingCenterDropDown></td>
          <td>{shopCenter ? "Data Snapshot as of " + lastUpdateDate : null}
              {shopCenter ? <Button style={{ margin:"0 0 0 10px" }} onClick={() => this.refreshSnapshot()} primary>Refresh Snapshot</Button> : null}
          </td>
          </tr></tbody></table>
        </div>
        <Table
            shopCenter={shopCenter}
        />
        <VarianceTable
            shopCenter={shopCenter}
        />      
      </div>
    );
  }
}

class Table extends React.Component {
  constructor(props) {
    super(props);
    this.state = {shopCenter: '', data: [], status: 'current', loading:false,};
    this.renderEditableString = this.renderEditableString.bind(this);
    this.renderEditableNumber = this.renderEditableNumber.bind(this);
    this.renderCheckbox = this.renderCheckbox.bind(this);
    this.llWorkFlagChangeHandler = this.llWorkFlagChangeHandler.bind(this);
    this.renderCurTenant = this.renderCurTenant.bind(this);
    this.createUnit = this.createUnit.bind(this);
    this.handleCreateUnit = this.handleCreateUnit.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.onUnload = this.onUnload.bind(this);
    this.commentsChangeHandler = this.commentsChangeHandler.bind(this);
  }

  fetchData(shopCenter) {
    axios(`http://dlvsbl03:3000/api/scobusy/shoppingCenter=${shopCenter}`)
      .then(response => {
        const data = response.data.map((property) => {
          return {
            recordType: property.Type, 
            unitType: "Existing", 
            unit: property.Unit, 
            area: property.CUR_AREA,
            comments: property.COMMENTS,
            curTenant: property.CUR_TEN,
            curTenantType: property.CUR_TENANT_TYPE,
            expDate: property.END_DATE ? new Date(property.END_DATE).toISOString().slice(0,10) : null,
            futTenant: property.FUT_TEN,
            futCOOPSF: property.FUT_COO_PSF,
            leaseExecDate: property.LEASE_EXECUTION_DATE ? new Date(property.LEASE_EXECUTION_DATE).toISOString().slice(0,10) : null,
            llWorkFlag: property.LL_WORK_FLAG,
            DOP: property.DOP ? new Date(property.DOP).toISOString().slice(0,10) : null,
            constrStartDate: property.CONSTR_START_DATE ? new Date(property.CONSTR_START_DATE).toISOString().slice(0,10) : null,
            RCD: property.RCD ? new Date(property.RCD).toISOString().slice(0,10) : null,
            jan: property.JAN, 
            feb: property.FEB,
            mar: property.MAR,
            apr: property.APR,
            may: property.MAY,
            jun: property.JUN,
            jul: property.JUL,
            aug: property.AUG,
            sep: property.SEP,
            oct: property.OCT,
            nov: property.NOV,
            dec: property.DEC,
            orgExpDate: property.ORG_CUR_TEN_END_DATE ? new Date(property.ORG_CUR_TEN_END_DATE).toISOString().slice(0,10) : null,
            dopFlag: property.DOP_DATE_FLAG,
            execFlag: property.EXECUTED_DATE_FLAG,
            constrFlag: property.CONSTR_START_DATE_FLAG
          }
        });
        this.setState({shopCenter: shopCenter, data: data, status: 'current', loading:false});
    })
  }

  createUnit() {
    const data = [...this.state.data];
    this.setState({createItemFormVisible: true})
    
  }
  
  saveData() {
    console.log('SAVE');
    const data = [...this.state.data];
    const shopCenter = this.state.shopCenter;
    const self = this;
    let modRecords = 0;
    let savRecords = 0;
    let errRecords = 0;
    data.forEach(function(record) {
      if (record.unitType === 'modified' || record.unitType === 'new') {
        modRecords = modRecords + 1;
      }
    });
    console.log('MOD RECORDS:' + modRecords);
    
    data.forEach(function(record) {
      const unitId = shopCenter+'.'+record.unit;
      const data1 = {
        TYPE: record.recordType,
        CUR_AREA: record.area,
        END_DATE: record.expDate,
        RCD: record.RCD,
        JAN: record.jan,
        FEB: record.feb,
        MAR: record.mar,
        APR: record.apr,
        MAY: record.may,
        JUN: record.jun,
        JUL: record.jul,
        AUG: record.aug,
        SEP: record.sep,
        OCT: record.oct,
        NOV: record.nov,
        DEC: record.dec,
        COMMENTS: record.comments,
        CUR_TEN: record.curTenant,
        FUT_TEN: record.futTenant,
        FUT_COO_PSF: record.futCOOPSF,
        LEASE_EXECUTION_DATE: record.leaseExecDate,
        LL_WORK_FLAG: record.llWorkFlag,
        DOP: record.DOP,
        CONSTR_START_DATE: record.constrStartDate
      };

      if (record.unitType === 'modified') {
        fetch('http://dlvsbl03:3000/api/scobusy/unitId='+unitId, {
          method: 'PUT',
          body: JSON.stringify(data1),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (res.ok)
            savRecords = savRecords + 1;
          else
            errRecords = errRecords + 1;
          if (savRecords+errRecords === modRecords) {
            console.log('Records Saved: '+ savRecords + '; Errors: ' + errRecords);
            self.setState({shopCenter: "reload"});
          }
          return res;
        }).catch(err => {
          console.log(err)
          errRecords = errRecords + 1;
          if (savRecords+errRecords === modRecords) {
            console.log('Records Saved: '+ savRecords + '; Errors: ' + errRecords);
            self.setState({shopCenter: "reload"});
          }
        });
      }  
      if (record.unitType === 'new') {
        console.log(unitId);
        console.log(JSON.stringify(data1));
        fetch('http://dlvsbl03:3000/api/scobusy/unitId='+unitId, {
          method: 'POST',
          body: JSON.stringify(data1),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          console.log('POST res');
          console.log(res);
          console.log('NEW:'+record.unit);
          if (res.ok)
            savRecords = savRecords + 1;
          else
            errRecords = errRecords + 1;
          if (savRecords+errRecords === modRecords) {
            console.log('Records Saved: '+ savRecords + '; Errors: ' + errRecords);
            self.setState({shopCenter: "reload"});
          }
          return res;
        }).catch(err => {
          console.log(err)
          errRecords = errRecords + 1;
          if (savRecords+errRecords === modRecords) {
            console.log('Records Saved: '+ savRecords + '; Errors: ' + errRecords);
            self.setState({shopCenter: "reload"});
          }
        });
      }  
    });

    alertify.alert('Changes Saved').setHeader('Success!')

    //Remove the event listener that doesnt let the user out of the page on modified status
    window.removeEventListener("beforeunload", (event) => this.onUnload(event) )
  }

  discardChangesHandler(){
    alertify.confirm('Discard Changes!', 'You have <b style="color:red">UNSAVED</b> changes, if you proceed you will lose your changes.<br/><br/> Press <b>OK</b> to reload the site. <br/> Press <b>Cancel</b> to go back.', function(){
      window.location.reload();
    }
    , function(){});
  }

  renderCurTenant(cellInfo) {
    return (
      <div
        style={{ 
          backgroundColor: 
              cellInfo.index && this.state.data[cellInfo.index]["curTenantType"] === 'Perm' ? "#C4FDC4" 
            : cellInfo.index && this.state.data[cellInfo.index]["curTenant"] ? "#FFFF99" 
            : "white" 
        }}
        dangerouslySetInnerHTML={{
          __html: cellInfo.index ? this.state.data[cellInfo.index].curTenant : this.state.data[0].curTenant
        }}

      />
    );
  }

  renderEditableString(cellInfo) {
    return (
      <div
        style={{ 
          backgroundColor: 
              cellInfo.index && this.state.data[cellInfo.index]["curTenantType"] === 'Perm' && cellInfo.column.id === 'curTenant' ? "#C4FDC4" 
            : cellInfo.index && this.state.data[cellInfo.index]["curTenant"] && cellInfo.column.id === 'curTenant' ? "#FFFF99" 
            : "white", 
          color:
              cellInfo.index && this.state.data[cellInfo.index]["execFlag"] === 'Y' && cellInfo.column.id === 'leaseExecDate' ? "green"
            : cellInfo.index && this.state.data[cellInfo.index]["constrFlag"] === 'Y' && cellInfo.column.id === 'constrStartDate' ? "green"
            : cellInfo.index && this.state.data[cellInfo.index]["dopFlag"] === 'Y' && cellInfo.column.id === 'DOP' ? "green"
            : "black"  
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={e => {
          const data = [...this.state.data];
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          if ((cellInfo.column.id === 'leaseExecDate' && data[cellInfo.index]["execFlag"] === 'Y') ||
              (cellInfo.column.id === 'constrStartDate' && data[cellInfo.index]["constrFlag"] === 'Y') ||
              (cellInfo.column.id === 'DOP' && data[cellInfo.index]["dopFlag"] === 'Y')) {
            e.target.innerHTML = dataCell;
            alertify.error('Can not overwrite CRM date');  
          }  
        }}  
        onBlur={e => {
          const data = [...this.state.data];
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          let htmlCell = e.target.innerHTML;

          // console.log('htmlCell: ' , htmlCell)
          // console.log('dataCell: ', dataCell)
          
          if (htmlCell === '') {htmlCell = null;}
          if (htmlCell && ['expDate','leaseExecDate','constrStartDate','RCD','DOP'].includes(cellInfo.column.id)) {
            const dt = new Date(htmlCell); 
            if (isNaN(dt)) {
              htmlCell = dataCell; 
              e.target.innerHTML = dataCell;
              alertify.error('Please enter valid date');
            } 
            else if (cellInfo.column.id === 'expDate' && dt > new Date(data[cellInfo.index]["orgExpDate"])) {
              htmlCell = dataCell; 
              e.target.innerHTML = dataCell;
              alertify.error('Can not extend existing exp date. Please use future section for extentions.');
            }
            else {
              const dtFormat = dt.toISOString().slice(0,10);
              if (dtFormat !== htmlCell) {
                htmlCell = dtFormat;
                e.target.innerHTML = dtFormat;
              }
            } 
          };
          if (dataCell !== htmlCell) {          
            this.setState({ status: 'modified' });
            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
          }  
          data[cellInfo.index][cellInfo.column.id] = htmlCell;
          this.setState({ data: data });
        }}
        dangerouslySetInnerHTML={{
          __html: cellInfo.index ? this.state.data[cellInfo.index][cellInfo.column.id] : this.state.data[0][cellInfo.column.id]
        }}

      />
    );
  }

  renderCheckbox(cellInfo) {
    return (
      <div>
        <input type="checkbox" id="llWorkFlag" name="llWorkFlag" 
          onChange={(e) => this.llWorkFlagChangeHandler(e,cellInfo)}
          checked = {cellInfo.index && this.state.data[cellInfo.index]["llWorkFlag"] === 'Y' ? "checked" : null}
          />
      </div>
    );
  }

  llWorkFlagChangeHandler(e,cellInfo){
    
    const data = [...this.state.data];
    const dataCell = data[cellInfo.index][cellInfo.column.id];
    let htmlCell = e.target.checked === true ? "Y" : "N";                  
      
      if (htmlCell === '') {htmlCell = null;}
          if (dataCell !== htmlCell) {          
            this.setState({ status: 'modified' });

            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
          }
          
    data[cellInfo.index][cellInfo.column.id] = htmlCell;
    
    this.setState({ data: data });
  } 

  commentsChangeHandler(e,cellInfo){

    const data = [...this.state.data];
    const dataCell = data[cellInfo.index][cellInfo.column.id];
    let htmlCell = e;

    // console.log('dataCell: ', dataCell);
      
      if (htmlCell === '') {htmlCell = null;}
          if (dataCell !== htmlCell) {          
            this.setState({ status: 'modified' });

            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
          }  
    data[cellInfo.index][cellInfo.column.id] = htmlCell;
    
    this.setState({ data: data });
    
  } 

  dateChangeHandler(e,cellInfo){
    const data = [...this.state.data];
    const dataCell = data[cellInfo.index][cellInfo.column.id];
    let htmlCell = e.target.value;       
      
      if (htmlCell === '') {htmlCell = null;}
          if (dataCell !== htmlCell) {          
            this.setState({ status: 'modified' });

            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
          }  
    data[cellInfo.index][cellInfo.column.id] = htmlCell;
    
    this.setState({ data: data });
  }


  colorNumber(cellInfo, type) {
    const rownum = cellInfo.index ? cellInfo.index : 0;
    const expDate = new Date(this.state.data[rownum]["expDate"]);
    const rcdDate = new Date(this.state.data[rownum]["RCD"]);
    const n = cellInfo.column.id === 'jan' ? 0 : 
              cellInfo.column.id === 'feb' ? 1 :
              cellInfo.column.id === 'mar' ? 2 :
              cellInfo.column.id === 'apr' ? 3 :
              cellInfo.column.id === 'may' ? 4 :
              cellInfo.column.id === 'jun' ? 5 :
              cellInfo.column.id === 'jul' ? 6 :
              cellInfo.column.id === 'aug' ? 7 :
              cellInfo.column.id === 'sep' ? 8 :
              cellInfo.column.id === 'oct' ? 9 :
              cellInfo.column.id === 'nov' ? 10 :
              cellInfo.column.id === 'dec' ? 11 :
              null;
    const cellStartDate = new Date(2019,n,1);
    const cellEndDate = new Date(2019,n+1,0);
    if (expDate >= cellStartDate) {
      if (type === 'bg') return("#C4FDC4");
    }  
    if (rcdDate <= cellEndDate && rcdDate > new Date(2019,0,0)){
      if (type === 'bg') return("#C4FDC4");
      if (type === 'color') return("red");
    } 
    if (this.state.data[rownum][cellInfo.column.id] && type === 'bg') return("#FFFF99"); 
    if (type === 'bg') return ("white"); else return("black");
  }

  renderEditableNumber(cellInfo) {
    if (cellInfo.index && this.state.data[cellInfo.index][cellInfo.column.id]) {
    return (
      <div
        style={{ backgroundColor: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'white' : this.colorNumber(cellInfo,"bg"), 
                           color: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'black' : this.colorNumber(cellInfo,"color") }}
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {

          const data = [...this.state.data];

          const htmlCell = e.target.innerHTML;
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          if (isNaN(htmlCell)) {
            e.target.innerHTML = dataCell;
            alertify.error('Please enter valid number');
          } 

          if (e.target.innerHTML) {
            if (data[cellInfo.index][cellInfo.column.id] !== parseInt(e.target.innerHTML.replace(",","").replace("$",""),10)) {
              if (data[cellInfo.index]["unitType"] !== 'new')
                data[cellInfo.index]["unitType"] = 'modified';
              this.setState({ status: 'modified' });
            }  
            data[cellInfo.index][cellInfo.column.id] = parseInt(e.target.innerHTML.replace(",","").replace("$",""),10);
          }  
          else {
            if (data[cellInfo.index][cellInfo.column.id]) {
              if (data[cellInfo.index]["unitType"] !== 'new')
                data[cellInfo.index]["unitType"] = 'modified';
              this.setState({ status: 'modified' });
            }  
            data[cellInfo.index][cellInfo.column.id] = null;
          }  
            
          this.setState({ data: data });
          
        }}
        dangerouslySetInnerHTML={{
          __html: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? this.state.data[cellInfo.index][cellInfo.column.id].toLocaleString() : this.state.data[cellInfo.index][cellInfo.column.id].toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
        }}
      />
    );
      }
    else if (cellInfo.index)
    return (
      <div
        style={{ backgroundColor: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'white' : this.colorNumber(cellInfo,"bg"), 
                           color: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'black' : this.colorNumber(cellInfo,"color") }}
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {
          const data = [...this.state.data];

          const htmlCell = e.target.innerHTML;
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          if (isNaN(htmlCell)) {
            e.target.innerHTML = dataCell;
            alertify.error('Please enter valid number');
          } 

          if (e.target.innerHTML) {
            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
            this.setState({ status: 'modified' });
            data[cellInfo.index][cellInfo.column.id] = parseInt(e.target.innerHTML.replace(",","").replace("$",""),10);
          }  
          else
            data[cellInfo.index][cellInfo.column.id] = null;
          this.setState({ data: data });
          
        }}
        dangerouslySetInnerHTML={{
          __html: this.state.data[cellInfo.index][cellInfo.column.id]
        }}
      />
    );
    else if (this.state.data[0][cellInfo.column.id])
    return (
      <div
        style={{ backgroundColor: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'white' : this.colorNumber(cellInfo,"bg"), 
                           color: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'black' : this.colorNumber(cellInfo,"color") }}
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {
          const data = [...this.state.data];

          const htmlCell = e.target.innerHTML;
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          if (isNaN(htmlCell)) {
            e.target.innerHTML = dataCell;
            alertify.error('Please enter valid number');
          } 

          if (e.target.innerHTML) {
            if (data[cellInfo.index][cellInfo.column.id] !== parseInt(e.target.innerHTML.replace(",","").replace("$",""),10)) {
              if (data[cellInfo.index]["unitType"] !== 'new')
                data[cellInfo.index]["unitType"] = 'modified';
              this.setState({ status: 'modified' });
            }  
            data[cellInfo.index][cellInfo.column.id] = parseInt(e.target.innerHTML.replace(",","").replace("$",""),10);
            this.setState({ data: data });
          }
        }}
        dangerouslySetInnerHTML={{
          __html: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? this.state.data[0][cellInfo.column.id].toLocaleString() : this.state.data[0][cellInfo.column.id].toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
        }}

      />
    );
    else
    return (
      <div
        style={{ backgroundColor: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'white' : this.colorNumber(cellInfo,"bg"), 
                           color: (cellInfo.column.id === 'area' || cellInfo.column.id === 'futCOOPSF') ? 'black' : this.colorNumber(cellInfo,"color") }}
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {
          const data = [...this.state.data];

          const htmlCell = e.target.innerHTML;
          const dataCell = data[cellInfo.index][cellInfo.column.id];
          if (isNaN(htmlCell)) {
            e.target.innerHTML = dataCell;
            alertify.error('Please enter valid number');
          } 

          if (e.target.innerHTML) {
            if (data[cellInfo.index]["unitType"] !== 'new')
              data[cellInfo.index]["unitType"] = 'modified';
            this.setState({ status: 'modified' });
            data[cellInfo.index][cellInfo.column.id] = parseInt(e.target.innerHTML.replace(",","").replace("$",""),10);
            this.setState({ data: data });
          }
        }}
        dangerouslySetInnerHTML={{
          __html: this.state.data[0][cellInfo.column.id]
        }}
      />
    );
  }

  updateRecord() {
    const data = [...this.state.data];
    data.forEach(function(element) {
      if (element.unitType === 'modified') {
      }  
    });
    const data1 = {JAN: 1004, FEB: 2004};
    fetch('http://dlvsbl03:3000/api/scobusy/unitId=Inland%20Center.K01', {
      method: 'PUT',
      body: JSON.stringify(data1),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      console.log(res);
      return res;
    }).catch(err => console.log(err));
    
  }

  unitType(d) {
    return (
      <div
        style = {{backgroundColor: d.unitType === 'modified' ? "green" : d.unitType === 'new' ? "green" : "white", 
                            color: d.unitType === 'modified' ? "green" : d.unitType === 'new' ? "green" : "white"}}
        dangerouslySetInnerHTML={{
          __html: "."
        }}
      />  
    );  
  }

  colorTd(rowInfo, column) {
    return(rowInfo && column.id === 'jan' && rowInfo.row.unit === "E03" ? "red" : "white");
  }

  handleCreateUnit(unit) {
    alertify.alert('Unit <b>' +  unit + '</b> has been created<br/> Please enter additional data and press Save').setHeader('Success!')
    // this.setState({createItemFormVisible: false});
    const data = [...this.state.data];
    var newRow = {recordType: "Activity", unitType: "new", unit: unit,};
    data.unshift(newRow);
    this.setState({ data: data, status: 'modified', createItemFormVisible:false, });
  };

  createItemCancelButtonHandler = () => {
    this.setState({createItemFormVisible: false});
  }

  onUnload(event){
  event.returnValue = "";
}

render() {
    

    if (this.props.shopCenter && this.props.shopCenter !== this.state.shopCenter)
      this.fetchData(this.props.shopCenter);
    const { data } = this.state;
    const fontSize = 11;
    const amtWidth = 65;
    const dateWidth = 85;
    const amtFilterable = false;
    
    let createUnitButton;
    let saveButton;
    let discardChangesButton;
    let createItemForm;
    let createItemSuccessMessage;
    
    if (this.props.shopCenter) {
      createUnitButton = <Button onClick={() => this.createUnit()} style={{margin:"0 0 20px 0"}} content='Create New Unit' primary/>;
      
      if(this.state.createItemFormVisible === true){
        createUnitButton = <Button disabled onClick={() => this.createUnit()} style={{margin:"0 0 20px 0"}} content='Create New Unit' primary/>;
      }      
    }

    if (this.state.status === 'modified') {
      saveButton = <Button color="green" style={{ margin:"0 0 10px 10px" }} onClick={() => this.saveData()} content='Save'/>;
      discardChangesButton = <Button color="red" style={{ margin:"0 0 10px 10px" }} onClick={() => this.discardChangesHandler()} content='Discard Changes'/>;
      
      // Get ready to prompt the user if they navigate away from the page when modified is triggered.
      window.addEventListener('beforeunload', this.onUnload, true );
    }


    
    if (this.state.status === 'current') {

      // Get ready to prompt the user if they navigate away from the page when modified is triggered.
      window.removeEventListener('beforeunload',this.onUnload, true );
    }

    //if (createItemFormVisible === true) {
      createItemForm = <CreateItem show={this.state.createItemFormVisible} data={this.state.data} cancelButton={this.createItemCancelButtonHandler} onCreateUnit={this.handleCreateUnit}/>;
    //}

    return (
      <div>
      {/* <div style={{background:"orange", margin:"10px 0", padding:"10px", color:"white", fontSize:"20px"}}>Current Tenant: {this.state.hoveredTenant} </div> */}
      {createUnitButton}
      {createItemForm}
      {createItemSuccessMessage}
      {saveButton}
      {discardChangesButton}
      <ReactTable
          id="ReactTable"
          filterable
          data={data}
          getTheadTrProps={ state => ({ 
            style: { 
              //overflow: "unset", 
              minWidth: state.rowMinWidth,
              fontSize: 11
            } }) }
          getTrProps={(state, rowInfo, column) => {
            return {
              className: 'table-row',
              onFocus: (e, handleOriginal) => {
                if (handleOriginal) {
                  handleOriginal();
                }
              },
              onBlur: (e, handleOriginal) => { 
                if (handleOriginal) {
                  handleOriginal();
                }
              }
            };
          }}
          getTdProps={(state, rowInfo, column, instance) => {
            return {
              style: {
                padding: "0px 0px",
                fontSize: 11
              },
              // onMouseEnter: e => {
              //  this.hoveredTenantHandler(rowInfo.original.curTenant)
              // },
              // onPaste: (e, handleOriginal) => {
              //   e.target.innerHTML = e.clipboardData.getData("text/plain");
              //   // e.preventDefault();
              //   if (handleOriginal) {
              //     handleOriginal();
              //   }
              // },
              onFocus: (e, handleOriginal) => {
                if (column.id === 'jan' || 
                    column.id === 'feb' ||
                    column.id === 'mar' ||
                    column.id === 'apr' ||
                    column.id === 'may' ||
                    column.id === 'jun' ||
                    column.id === 'jul' ||
                    column.id === 'aug' ||
                    column.id === 'sep' ||
                    column.id === 'oct' ||
                    column.id === 'nov' ||
                    column.id === 'dec' ||
                    column.id === 'area'||
                    column.id === 'futCOOPSF'
                )
                  e.target.innerHTML = e.target.innerHTML.replace(",","").replace("$","");  
                if (handleOriginal) {
                  handleOriginal();
                }
              },
              onBlur: (e, handleOriginal) => {
                console.log('ONBLUR TDPROPS');
                
                if(this.state.status === 'modified'){
                }
                if (column.id === 'jan' || 
                    column.id === 'feb' ||
                    column.id === 'mar' ||
                    column.id === 'apr' ||
                    column.id === 'may' ||
                    column.id === 'jun' ||
                    column.id === 'jul' ||
                    column.id === 'aug' ||
                    column.id === 'sep' ||
                    column.id === 'oct' ||
                    column.id === 'nov' ||
                    column.id === 'dec'
                    )
                  if (e.target.innerHTML)
                    e.target.innerHTML = parseInt(e.target.innerHTML.replace(",","").replace("$",""),10).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0});
                  else
                    e.target.innerHTML = null;  
                if (handleOriginal) {
                  handleOriginal();
                }
              }
            };
          }}
          columns={[
            {
              Header: " ",
              style: {backgroundColor: "red"},
              columns: [
                {
                  Header: "Type",
                  accessor: "recordType",
                  width: 70,
                  Footer: <span style={{color:'black', fontSize:{fontSize}}}><b>Total</b></span>,
                  PivotValue: row => {
                    return (
                      <span style={{color:'black', fontSize:{fontSize}}}>
                        <b>{row.value}</b>
                      </span>
                    );
                  }
                }]
            },
            {
              Header: "Space",
              style: {overflow: "hidden"},
              columns: [
                {
                  Header: "",
                  id: "modified",
                  accessor: this.unitType,
                  filterable: false,
                  width: 5,
                  aggregate: vals => _.max(null)
                },
                {
                  Header: "Unit",
                  accessor: "unit",
                  Cell: this.renderEditableString,
                  width: 40,
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: "SF",
                  accessor: "area",
                  Cell: this.renderEditableNumber,
                  width: 40,
                  style: {textAlign: 'right'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: "Comments",
                  accessor: "comments",
                  Cell:(props, row) => (<Comments comments={props.row.comments} onChange={(e) => this.commentsChangeHandler(e,props)}></Comments>),
                  width: 145,
                  style: {textAlign: 'left'},
                  Aggregated: row => {}
                }]
            },
            {
              Header: "Cur Tenancy",
              style: {overflow: "hidden"},
              columns: [
                {
                  Header: "In Space Today",
                  accessor: "curTenant", 
                  Cell: this.renderCurTenant,
                  width: 140, 
                  style: {textAlign: 'left'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: () => <div>Perm Exp<br/>Date</div>,
                  accessor: "expDate",
                  Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <DateSelection currentDate={props.value} onChange={(e) => this.dateChangeHandler(e,props)}></DateSelection>
                  ),
                  */
                  width: dateWidth,
                  style: {textAlign: 'center'},
                  headerStyle: {overflow: "unset"},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                }]
            },
            {
              Header: "Future Perm Tenant",
              style: {overflow: "hidden"},
              columns: [
                {
                  Header: "Tenant",
                  accessor: "futTenant",
                  Cell: this.renderEditableString,
                  style: {textAlign: 'left',},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: () => <div>COO<br/>PSF</div>,
                  accessor: "futCOOPSF",
                  Cell: this.renderEditableNumber,
                  width: 40,
                  style: {textAlign: 'right'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: () => <div>Lease Exec<br/>Date</div>,
                  accessor: "leaseExecDate",
                  Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <DateSelection currentDate={props.value} onChange={(e) => this.dateChangeHandler(e,props)}></DateSelection>
                  ),
                  */
                  width: dateWidth,
                  style: {textAlign: 'center'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: () => <div>LL<br/>Work</div>,
                  accessor: "llWorkFlag",
                  //Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <CheckBoxSelection llWorkFlag={props.value} onChange={(e) => this.llWorkFlagChangeHandler(e,props)}></CheckBoxSelection>
                  ),
                  */
                  Cell: this.renderCheckbox,
                  width: 40,
                  style: {textAlign: 'center'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: () => <div>Constr Start<br/>Date</div>,
                  accessor: "constrStartDate",
                  Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <DateSelection currentDate={props.value} onChange={(e) => this.dateChangeHandler(e,props)}></DateSelection>
                  ),
                  */
                  width: dateWidth,
                  style: {textAlign: 'center'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: "DOP",
                  accessor: "DOP",
                  Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <DateSelection currentDate={props.value} onChange={(e) => this.dateChangeHandler(e,props)}></DateSelection>
                  ),
                  */
                  width: dateWidth,
                  style: {textAlign: 'center'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                },
                {
                  Header: "RCD",
                  accessor: "RCD",
                  Cell: this.renderEditableString,
                  /*
                  Cell: props => (
                    <DateSelection currentDate={props.value} onChange={(e) => this.dateChangeHandler(e,props)}></DateSelection>
                  ),
                  */
                  width: dateWidth,
                  style: {textAlign: 'center'},
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value}</b>
                        </span>
                      </div>                      
                    );
                  }
                }]
              },
              {
                Header: "2019 Gross COO",
                style: {overflow: "hidden"},
                columns: [
                  {
                  Header: "JAN",
                  accessor: "jan",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals?vals:0),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { jan }) => total += jan?jan:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "FEB",
                  accessor: "feb",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { feb }) => total += feb?feb:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "MAR",
                  accessor: "mar",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { mar }) => total += mar?mar:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "APR",
                  accessor: "apr",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { apr }) => total += apr?apr:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "MAY",
                  accessor: "may",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { may }) => total += may?may:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "JUN",
                  accessor: "jun",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { jun }) => total += jun?jun:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "JUL",
                  accessor: "jul",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { jul }) => total += jul?jul:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "AUG",
                  accessor: "aug",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { aug }) => total += aug?aug:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "SEP",
                  accessor: "sep",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { sep }) => total += sep?sep:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "OCT",
                  accessor: "oct",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { oct }) => total += oct?oct:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "NOV",
                  accessor: "nov",
                  Cell: this.renderEditableNumber,
                  width: amtWidth,
                  filterable:amtFilterable,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { nov }) => total += nov?nov:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
                {
                  Header: "DEC",
                  accessor: "dec",
                  Cell: this.renderEditableNumber,
                  filterable:amtFilterable,
                  width: amtWidth,
                  style: {textAlign: 'right'},
                  aggregate: vals => _.sum(vals),
                  Aggregated: row => {
                    return (
                      <div>
                        <span style={{color:'black', fontSize:{fontSize}}}>
                          <b>{row.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})}</b>
                        </span>
                      </div>                      
                    );
                  },
                  Footer: (
                    <div style={{padding:'0px 0px',margin:'0px',fontSize:fontSize}}><b>{
                      data.reduce((total, { dec }) => total += dec?dec:0, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0})
                    }</b></div>
                  )
                },
              ]}
          ]}
          defaultSorted={[
            {
              id: "recordType",
              desc: false
            },
            {
              id: "unit",
              desc: false
            }
          ]}
          pivotBy={["recordType"]}
          defaultPageSize={10}
          showPagination={false}
          style={{
            height: "487px" // This will force the table body to overflow and scroll, since there is not enough room
          }}
          //className="-striped -highlight"
          className="-highlight"
          expanded={ {0: true, 1: true, 2: true} }
        />
        <br />
      </div>
    );
  }
}

render(<App />, document.getElementById("root"),);
