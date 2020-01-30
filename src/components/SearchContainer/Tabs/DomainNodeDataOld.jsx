import React, { Component } from 'react';
import LoadLabel from './Components/LoadLabel.jsx';
import PropTypes from 'prop-types';
import NodeCypherLink from './Components/NodeCypherLink.jsx';
import NodeCypherNoNumberLink from './Components/NodeCypherNoNumberLink';
import NodeCypherLinkComplex from './Components/NodeCypherLinkComplex';
import NodeProps from './NodeProps';
import Gallery from 'react-photo-gallery';
import SelectedImage from './Components/SelectedImage';
import Lightbox from 'react-images';
import { readFileSync, writeFileSync } from 'fs';
import sizeOf from 'image-size';
import md5File from 'md5-file';
import { remote } from 'electron';
const { app } = remote;
import { join } from 'path';
import { withAlert } from 'react-alert';
import NodePlayCypherLink from './Components/NodePlayCypherLink.jsx';

class DomainNodeData extends Component {
    constructor() {
        super();

        this.state = {
            objectid: '',
            label: '',
            users: -1,
            groups: -1,
            computers: -1,
            ous: -1,
            gpos: -1,
            driversessions: [],
            propertyMap: {},
            displayMap: {
                description: 'Description',
                functionallevel: 'Domain Functional Level',
            },
            notes: null,
            pics: [],
            currentImage: 0,
            lightboxIsOpen: false,
        };

        emitter.on('domainNodeClicked', this.getNodeData.bind(this));
        emitter.on('computerNodeClicked', this.nullTarget.bind(this));
        emitter.on('groupNodeClicked', this.nullTarget.bind(this));
        emitter.on('userNodeClicked', this.nullTarget.bind(this));
        emitter.on('gpoNodeClicked', this.nullTarget.bind(this));
        emitter.on('ouNodeClicked', this.nullTarget.bind(this));
        emitter.on('imageUploadFinal', this.uploadImage.bind(this));
        emitter.on('clickPhoto', this.openLightbox.bind(this));
        emitter.on('deletePhoto', this.handleDelete.bind(this));
    }

    componentDidMount() {
        jQuery(this.refs.complete).hide();
        jQuery(this.refs.piccomplete).hide();
    }

    nullTarget() {
        this.setState({
            label: '',
        });
    }

    async getNodeData(payload) {
        jQuery(this.refs.complete).hide();
        $.each(this.state.driversessions, (_, record) => {
            record.close();
        });

        this.setState({
            objectid: payload,
            users: -1,
            groups: -1,
            computers: -1,
            ous: -1,
            gpos: -1,
        });

        let key = `domain_${this.state.label}`;
        let c = imageconf.get(key);
        let pics = [];
        if (typeof c !== 'undefined') {
            this.setState({ pics: c });
        } else {
            this.setState({ pics: pics });
        }

        let props = driver.session();
        let name;
        await props
            .run('MATCH (n:Domain {objectid: $objectid}) RETURN n', {
                objectid: payload,
            })
            .then(
                function(result) {
                    let properties = result.records[0]._fields[0].properties;
                    name = properties.name || properties.objectid;
                    let notes;
                    if (!properties.notes) {
                        notes = null;
                    } else {
                        notes = properties.notes;
                    }
                    this.setState({
                        propertyMap: properties,
                        notes: notes,
                        label: name,
                    });
                    props.close();
                }.bind(this)
            );

        let s1 = driver.session();
        let s2 = driver.session();
        let s3 = driver.session();
        let s4 = driver.session();
        let s5 = driver.session();
        s1.run('MATCH (a:User) WHERE a.domain=$objectid RETURN COUNT(a)', {
            objectid: name,
        }).then(
            function(result) {
                this.setState({ users: result.records[0]._fields[0] });
                s1.close();
            }.bind(this)
        );

        s2.run('MATCH (a:Group) WHERE a.domain=$objectid RETURN COUNT(a)', {
            objectid: name,
        }).then(
            function(result) {
                this.setState({ groups: result.records[0]._fields[0] });
                s2.close();
            }.bind(this)
        );

        s3.run('MATCH (n:Computer) WHERE n.domain=$objectid RETURN count(n)', {
            objectid: name,
        }).then(
            function(result) {
                this.setState({ computers: result.records[0]._fields[0] });
                s3.close();
            }.bind(this)
        );

        s4.run('MATCH (n:OU {domain:$objectid}) RETURN COUNT(n)', {
            objectid: name,
        }).then(
            function(result) {
                this.setState({ ous: result.records[0]._fields[0] });
                s4.close();
            }.bind(this)
        );

        s5.run('MATCH (n:GPO {domain:$objectid}) RETURN COUNT(n)', {
            objectid: name,
        }).then(
            function(result) {
                this.setState({ gpos: result.records[0]._fields[0] });
                s5.close();
            }.bind(this)
        );

        this.setState({ driversessions: [s1, s2, s3] });
    }

    notesChanged(event) {
        this.setState({ notes: event.target.value });
    }

    notesBlur(event) {
        let notes =
            this.state.notes === null || this.state.notes === ''
                ? null
                : this.state.notes;
        let q = driver.session();
        if (notes === null) {
            q.run('MATCH (n:Domain {objectid: $objectid}) REMOVE n.notes', {
                name: this.state.label,
            }).then(x => {
                q.close();
            });
        } else {
            q.run(
                'MATCH (n:Domain {objectid: $objectid}) SET n.notes = {notes}',
                {
                    name: this.state.label,
                    notes: this.state.notes,
                }
            ).then(x => {
                q.close();
            });
        }
        let check = jQuery(this.refs.complete);
        check.show();
        check.fadeOut(2000);
    }

    uploadImage(files) {
        if (!this.props.visible || files.length === 0) {
            return;
        }
        let p = this.state.pics;
        let oLen = p.length;
        let key = `domain_${this.state.label}`;

        $.each(files, (_, f) => {
            let exists = false;
            let hash = md5File.sync(f.path);
            $.each(p, (_, p1) => {
                if (p1.hash === hash) {
                    exists = true;
                }
            });
            if (exists) {
                this.props.alert.error('Image already exists');
                return;
            }
            let path = join(app.getPath('userData'), 'images', hash);
            let dimensions = sizeOf(f.path);
            let data = readFileSync(f.path);
            writeFileSync(path, data);
            p.push({
                hash: hash,
                src: path,
                width: dimensions.width,
                height: dimensions.height,
            });
        });

        if (p.length === oLen) {
            return;
        }
        this.setState({ pics: p });
        imageconf.set(key, p);
        let check = jQuery(this.refs.piccomplete);
        check.show();
        check.fadeOut(2000);
    }

    handleDelete(event) {
        if (!this.props.visible) {
            return;
        }
        let pics = this.state.pics;
        let temp = pics[event.index];
        pics.splice(event.index, 1);
        this.setState({
            pics: pics,
        });
        let key = `domain_${this.state.label}`;
        imageconf.set(key, pics);

        let check = jQuery(this.refs.piccomplete);
        check.show();
        check.fadeOut(2000);
    }

    openLightbox(event) {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: event.index,
            lightboxIsOpen: true,
        });
    }
    closeLightbox() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: 0,
            lightboxIsOpen: false,
        });
    }
    gotoPrevious() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: this.state.currentImage - 1,
        });
    }
    gotoNext() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: this.state.currentImage + 1,
        });
    }

    render() {
        let gallery;
        if (this.state.pics.length === 0) {
            gallery = <span>Drop pictures on here to upload!</span>;
        } else {
            gallery = (
                <React.Fragment>
                    <Gallery
                        photos={this.state.pics}
                        ImageComponent={SelectedImage}
                        className={'gallerymod'}
                    />
                    <Lightbox
                        images={this.state.pics}
                        isOpen={this.state.lightboxIsOpen}
                        onClose={this.closeLightbox.bind(this)}
                        onClickPrev={this.gotoPrevious.bind(this)}
                        onClickNext={this.gotoNext.bind(this)}
                        currentImage={this.state.currentImage}
                    />
                </React.Fragment>
            );
        }

        return (
            <div className={this.props.visible ? '' : 'displaynone'}>
                <dl className='dl-horizontal'>
                    <dt>Domain</dt>
                    <dd>{this.state.label}</dd>
                    <NodeProps
                        properties={this.state.propertyMap}
                        displayMap={this.state.displayMap}
                        ServicePrincipalNames={[]}
                    />
                    <dt>Users</dt>
                    <dd>
                        <LoadLabel
                            ready={this.state.users !== -1}
                            value={this.state.users}
                        />
                    </dd>
                    <dt>Groups</dt>
                    <dd>
                        <LoadLabel
                            ready={this.state.groups !== -1}
                            value={this.state.groups}
                        />
                    </dd>
                    <dt>Computers</dt>
                    <dd>
                        <LoadLabel
                            ready={this.state.computers !== -1}
                            value={this.state.computers}
                        />
                    </dd>
                    <dt>OUs</dt>
                    <dd>
                        <LoadLabel
                            ready={this.state.ous !== -1}
                            value={this.state.ous}
                        />
                    </dd>
                    <dt>GPOs</dt>
                    <dd>
                        <LoadLabel
                            ready={this.state.gpos !== -1}
                            value={this.state.gpos}
                        />
                    </dd>
                    <NodeCypherNoNumberLink
                        target={this.state.objectid}
                        property='Map OU Structure'
                        query='MATCH p = (d:Domain {objectid: $objectid})-[r:Contains*1..]->(n) RETURN p'
                    />
                    <br />
                    <h4>Foreign Members</h4>

                    <NodeCypherLink
                        property='Foreign Users'
                        target={this.state.label}
                        baseQuery={
                            'MATCH (n:User) WHERE NOT n.domain=$objectid WITH n MATCH (b:Group) WHERE b.domain=$objectid WITH n,b MATCH p=(n)-[r:MemberOf]->(b)'
                        }
                    />

                    <NodeCypherLink
                        property='Foreign Groups'
                        target={this.state.label}
                        baseQuery={
                            'MATCH (n:Group) WHERE NOT n.domain=$objectid WITH n MATCH (b:Group) WHERE b.domain=$objectid WITH n,b MATCH p=(n)-[r:MemberOf]->(b)'
                        }
                    />

                    <NodeCypherLinkComplex
                        property='Foreign Admins'
                        target={this.state.label}
                        countQuery={
                            'MATCH (u:User) WHERE NOT u.domain = $objectid OPTIONAL MATCH (u)-[:AdminTo]->(c {domain:$objectid}) OPTIONAL MATCH (u)-[:MemberOf*1..]->(:Group)-[:AdminTo]->(c {domain:$objectid}) RETURN COUNT(DISTINCT(u))'
                        }
                        graphQuery={
                            'MATCH (u:User) WHERE NOT u.domain = $objectid OPTIONAL MATCH p1 = (u)-[:AdminTo]->(c {domain:$objectid}) OPTIONAL MATCH p2 = (u)-[:MemberOf*1..]->(:Group)-[:AdminTo]->(c {domain:$objectid}) RETURN p1,p2'
                        }
                    />

                    <NodeCypherLink
                        property='Foreign GPO Controllers'
                        target={this.state.label}
                        baseQuery={
                            'MATCH (n) WHERE NOT n.domain=$objectid WITH n MATCH (b:GPO) WHERE b.domain=$objectid WITH n,b MATCH p=(n)-[r]->(b) WHERE r.isacl=true'
                        }
                    />

                    <h4>Inbound Trusts</h4>
                    <NodeCypherLink
                        property='First Degree Trusts'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(a:Domain {objectid: $objectid})<-[r:TrustedBy]-(n:Domain)'
                        }
                    />

                    <NodeCypherLink
                        property='Effective Inbound Trusts'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (n:Domain) WHERE NOT n.objectid=$objectid WITH n MATCH p=shortestPath((a:Domain {objectid: $objectid})<-[r:TrustedBy*1..]-(n))'
                        }
                    />

                    <h4>Outbound Trusts</h4>
                    <NodeCypherLink
                        property='First Degree Trusts'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(a:Domain {objectid: $objectid})-[r:TrustedBy]->(n:Domain)'
                        }
                    />

                    <NodeCypherLink
                        property='Effective Outbound Trusts'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (n:Domain) WHERE NOT n.objectid=$objectid MATCH p=shortestPath((a:Domain {objectid: $objectid})-[r:TrustedBy*1..]->(n))'
                        }
                    />

                    <h4>Inbound Controllers</h4>

                    <NodeCypherLink
                        property='First Degree Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(n)-[r]->(u:Domain {objectid: $objectid}) WHERE r.isacl=true'
                        }
                        distinct
                    />

                    <NodeCypherLink
                        property='Unrolled Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(n)-[r:MemberOf*1..]->(g:Group)-[r1]->(u:Domain {objectid: $objectid}) WHERE r1.isacl=true'
                        }
                        distinct
                    />

                    <NodePlayCypherLink
                        property='Transitive Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=shortestPath((n)-[r1:MemberOf|AllExtendedRights|GenericAll|GenericWrite|WriteDacl|WriteOwner|Owns*1..]->(u:Domain {objectid: $objectid})) WHERE NOT n.objectid=$objectid'
                        }
                        distinct
                    />

                    <NodeCypherLinkComplex
                        property='Calculated Principals with DCSync Privileges'
                        target={this.state.objectid}
                        countQuery={
                            'MATCH (n1)-[:MemberOf|GetChanges*1..]->(u:Domain {objectid: $objectid}) WITH n1,u MATCH (n1)-[:MemberOf|GetChangesAll*1..]->(u) WITH n1,u MATCH p = (n1)-[:MemberOf|GetChanges|GetChangesAll*1..]->(u) RETURN COUNT(DISTINCT(n1))'
                        }
                        graphQuery={
                            'MATCH (n1)-[:MemberOf|GetChanges*1..]->(u:Domain {objectid: $objectid}) WITH n1,u MATCH (n1)-[:MemberOf|GetChangesAll*1..]->(u) WITH n1,u MATCH p = (n1)-[:MemberOf|GetChanges|GetChangesAll*1..]->(u) RETURN p'
                        }
                    />
                </dl>
                <div>
                    <h4 className={'inline'}>Notes</h4>
                    <i
                        ref='complete'
                        className='fa fa-check-circle green-icon-color notes-check-style'
                    />
                </div>
                <textarea
                    onBlur={this.notesBlur.bind(this)}
                    onChange={this.notesChanged.bind(this)}
                    value={this.state.notes === null ? '' : this.state.notes}
                    className={'node-notes-textarea'}
                    ref='notes'
                />
                <div>
                    <h4 className={'inline'}>Pictures</h4>
                    <i
                        ref='piccomplete'
                        className='fa fa-check-circle green-icon-color notes-check-style'
                    />
                </div>
                {gallery}
            </div>
        );
    }
}

DomainNodeData.propTypes = {
    visible: PropTypes.bool.isRequired,
};

export default withAlert()(DomainNodeData);